import fs from 'node:fs'
import { connect } from './browser-audit.mjs'
const out=process.argv[3]
if(!out)throw new Error('Usage: node scripts/audit-scenes.mjs <dev-url> <fresh-output-directory> [sceneIds]')
if(fs.existsSync(`${out}/report.json`))throw new Error(`Refusing to overwrite audit evidence: ${out}`)
fs.mkdirSync(out,{recursive:true})
const scenes={
 'railway-crossing':['p1_road','p1_car_talk','p1_turn'],
 'tea-stall':['tea_stall','tea_wake','tea_stall_tape','tea_stall_mirror','ending_waiting'],
 'childhood-house':['house_exterior','house_exterior_captured','road_footsteps','corridor','bedroom_horse','photo_shadow','corridor_call','entity_reveal','truth','ending_forgetting'],
 'return-road':['ending_remembering','ending_remembering_horse','ending_remembering_empty','ending_return','ending_return_horse'],
}
const url=process.argv[2]||'http://localhost:5173/'
const client=await connect('kaali-story-visuals',url,true)
const runtime=[],consoleErrors=[],report=[]
client.on('Runtime.exceptionThrown',e=>runtime.push(e.exceptionDetails.exception?.description||e.exceptionDetails.text))
client.on('Runtime.consoleAPICalled',e=>{if(e.type==='error')consoleErrors.push(e.args.map(a=>a.value||a.description).join(' '))})
const files=new Map()
let sequence=0
try{
 await client.call('Runtime.enable'); await client.call('Page.enable')
 const navigated=new Promise(resolve=>client.on('Page.frameNavigated',e=>{if(!e.frame.parentId)resolve(e)}))
 await client.call('Page.navigate',{url:new URL('?start=part1',url).href})
 await navigated
 await client.call('Page.bringToFront')
 await client.until('typeof kr!=="undefined" && typeof r3f!=="undefined" && typeof kr.inspectFrame==="function" && document.readyState==="complete"','Scene quality tools',600)
 await client.wait(900)
 for(const [folder,ids] of Object.entries(scenes))for(const id of ids){
  const path=`/src/scenes/${folder}/${id}.json`
  const cfg=await client.evaluate(`fetch(${JSON.stringify(path)}).then(r=>r.json())`)
  files.set(id,{folder,cfg})
  console.log('Loaded',id,cfg.shots.length,'shots')
 }
 for(const [format,width,height,mobile] of [['portrait',390,844,true],['landscape',1280,720,false]]){
  await client.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile})
  for(const [id,{folder,cfg}] of files){
   if(process.argv[4]&&!process.argv[4].split(',').includes(id))continue
   const flags=['corridor','corridor_call','truth','entity_reveal','ending_remembering_horse','ending_return_horse'].includes(id)?{entered_bedroom:true,has_horse:true}:{  }
   let shotStart=0
   for(let i=0;i<cfg.shots.length;i++){
    const shot=cfg.shots[i]
    const fractions=['the_wooden_horse','both_hands'].includes(shot.id)?[0.65]:[0.035,0.6,0.965]
    for(const fraction of fractions){
     let t=shotStart+shot.duration*fraction
     if(id==='bedroom_horse'&&shot.id==='the_wooden_horse')t=9
     if(id==='bedroom_horse'&&shot.id==='both_hands')t=18.5
     await client.evaluate(`kr.setPaused(true);kr.previewScene(${JSON.stringify(cfg)},${t},[],${JSON.stringify(flags)})`)
     await client.wait(160)
     const sample=await client.evaluate(`({shot:${JSON.stringify(shot.id)},issues:kr.inspectFrame(r3f.scene,r3f.camera,kr.scene.shots[${i}]),camera:r3f.camera.position.toArray(),fov:r3f.camera.fov,t:${t},sceneId:${JSON.stringify(id)},format:${JSON.stringify(format)}})`)
     report.push(sample)
     if(sample.issues.length)console.log('AUDIT',id,shot.id,format,t,JSON.stringify(sample.issues))
     const subject=process.argv.includes('--all-shots')||(shot.focus&&['the_wooden_horse','both_hands','the_unplugged_radio','mirror_gap','three_people','the_fourth_shadow','the_open_diary','the_date','the_offering','burn_the_page','an_ordinary_face','under_the_barrier','bhaiya','feet_facing_forward'].includes(shot.id))
     const middle=fraction===0.6||(['the_wooden_horse','both_hands'].includes(shot.id)&&fraction===0.65)
     if((subject&&middle)||sample.issues.some(issue=>!issue.optional)){
      const file=`${String(++sequence).padStart(2,'0')}-${id}-${shot.id}-${format}.png`
      await client.screenshot(`${out}/${file}`)
      sample.image=file
     }
    }
    shotStart+=shot.duration
   }
  }
 }
}catch(error){report.push({harnessError:String(error)});console.error(error)}
finally{
 const surfaces=await client.evaluate('kr.getSurfaceStatus()')
 fs.writeFileSync(`${out}/report.json`,JSON.stringify({samples:report,runtime,consoleErrors,surfaces},null,2))
 console.log('SURFACES',JSON.stringify(surfaces))
 await client.call('Emulation.clearDeviceMetricsOverride').catch(()=>{})
 client.close()
}
const failures=report.filter(sample=>sample.issues?.some(issue=>!issue.optional)||sample.harnessError)
console.log('Samples',report.length,'issues',report.reduce((n,s)=>n+(s.issues?.length||0),0),'runtime errors',runtime.length,'failures',failures.length)
if(failures.length||runtime.length||consoleErrors.length)process.exitCode=1
