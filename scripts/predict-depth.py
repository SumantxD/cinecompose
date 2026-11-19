#!/usr/bin/env python3
"""Local Depth Anything V2 ONNX inference. Photo/depth stay on this machine; no network calls here."""
import argparse, hashlib, json, math, os, time
from pathlib import Path
import numpy as np
import onnxruntime as ort
from PIL import Image

p = argparse.ArgumentParser()
p.add_argument('--image', required=True)
p.add_argument('--model', required=True, help='Verified local ONNX file; weights are never downloaded by this script.')
p.add_argument('--out', required=True, help='New output directory; existing evidence is not overwritten.')
p.add_argument('--crop', help='Optional x,y,width,height before inference.')
p.add_argument('--max-size', type=int, default=1200)
a = p.parse_args()
image_path, model_path, out = Path(a.image).resolve(), Path(a.model).resolve(), Path(a.out).resolve()
if not model_path.is_file(): p.error('Model not found. Download/verify it separately; inference does not fetch it.')
out.mkdir(parents=True, exist_ok=True)
if (out/'provenance.json').exists(): p.error(f'Refusing to overwrite {out}/provenance.json')
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
image = Image.open(image_path).convert('RGB')
if a.crop:
    x,y,w,h = map(int, a.crop.split(','))
    if x < 0 or y < 0 or w <= 0 or h <= 0 or x+w > image.width or y+h > image.height: p.error('Crop is outside the image.')
    image = image.crop((x,y,x+w,y+h))
image.thumbnail((a.max_size,a.max_size), Image.Resampling.LANCZOS)
orig_w, orig_h = image.size
scale = min(518/orig_w, 518/orig_h)
w, h = max(14, round(orig_w*scale/14)*14), max(14, round(orig_h*scale/14)*14)
xpad, ypad = (518-w)//2, (518-h)//2
resized = image.resize((w,h),Image.Resampling.BICUBIC)
padded = Image.new('RGB',(518,518))
padded.paste(resized,(xpad,ypad))
tensor = np.asarray(padded,dtype=np.float32)/255
tensor = (tensor-np.array([.485,.456,.406],dtype=np.float32))/np.array([.229,.224,.225],dtype=np.float32)
tensor = np.transpose(tensor,(2,0,1))[None]
start = time.perf_counter()
session = ort.InferenceSession(str(model_path),providers=['CPUExecutionProvider'])
inputs = session.get_inputs()[0]
if tensor.shape[0] != 1 or tensor.shape[1] != 3: p.error(f'Expected NCHW input, got {tensor.shape}.')
raw = session.run(None,{inputs.name:tensor})[0].squeeze()
seconds = time.perf_counter()-start
cropped = raw[ypad:ypad+h,xpad:xpad+w]
depth = np.asarray(Image.fromarray(cropped.astype(np.float32),mode='F').resize((orig_w,orig_h),Image.Resampling.BILINEAR))
lo,hi = np.percentile(depth,[2,98])
if not np.isfinite(depth).all() or hi <= lo: p.error('Model produced invalid/flat relative depth.')
normalized = np.clip((depth-lo)/(hi-lo),0,1)
if float(normalized.min()) > .02 or float(normalized.max()) < .98: p.error('Normalization did not use the full relative range.')
Image.fromarray(np.rint(normalized*255).astype(np.uint8),'L').save(out/'depth.png')
image.save(out/'photo.jpg',quality=94)
provenance = {
 'version':1,'model':'Depth-Anything-V2-Small','modelFormat':'ONNX dynamic INT8',
 'modelSource':'https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/main/onnx/model_quantized.onnx',
 'modelSha256':sha(model_path),'imageSha256':sha(image_path),'imageOrigin':str(image_path),
 'photo':{'width':orig_w,'height':orig_h,'crop':a.crop},
 'preprocess':{'height':518,'width':518,'aspect':'resize-to-multiple-of-14 then zero-pad','pad':[xpad,ypad,518-w-xpad,518-h-ypad],'normalization':'ImageNet'},
 'depth':{'width':orig_w,'height':orig_h,'relativeDepthMin':float(depth.min()),'relativeDepthMax':float(depth.max()),'clipPercentiles':[float(lo),float(hi)],'encoding':'white = nearer, black = farther; relative scale only'},
 'runtime':{'provider':'CPUExecutionProvider','inferenceSeconds':round(seconds,3),'pythonPackage':'onnxruntime','numpy':np.__version__},
 'rights':'private reference study; no release or ownership claim from depth inference',
}
(out/'provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
print(json.dumps({'depth':str(out/'depth.png'),'photo':str(out/'photo.jpg'),'inferenceSeconds':provenance['runtime']['inferenceSeconds'],'size':[orig_w,orig_h],'minMax':[float(depth.min()),float(depth.max())]}))
