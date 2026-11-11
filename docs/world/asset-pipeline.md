# Asset Pipeline

## Order of preference

1. **Procedural / code**: deterministic, zero download, versioned in git.
2. **CC0 PBR textures and HDRIs**: ambientCG, Poly Haven. Use these first for any hard surface.
3. **CC0 models**: Poly Haven, Kenney, Quaternius (check the style fits; most of it is Western or stylised).
4. **CC-BY models** (Sketchfab): only with attribution recorded.
5. **AI-generated GLB** (Meshy, Tripo, Rodin, Hunyuan3D): see the rules below.

**Never** use NC, ND, "personal use", unclear, or ripped assets.

## AI-generated 3D: rules

The original brief forbids *paid* AI generation. If the team decides to use a free tier:
- Read **that tool's current terms for free-tier output** at generation time and record them, because they differ and they change. Some free tiers make output public, require attribution, or restrict commercial use.
- **Image-to-3D beats text-to-3D**: generate or draw a reference image first, so models stay consistent.
- Treat the output as raw. Decimate (target ≤ 15k triangles for a hero prop, ≤ 3k for a background prop), fix the scale to metres, re-bake or replace textures with our PBR set so materials match the scene, and check it under *our* lighting before committing.
- Log it in `docs/decisions.md`: which tool, which tier, the license text or link, and the date.

## Adding a file

1. Download it into the repo (`public/models`, `public/textures`, `public/hdri`). **Never hotlink**, because external URLs disappear.
2. Optimise:
   - GLB: `npx @gltf-transform/cli optimize in.glb out.glb --compress meshopt --texture-compress webp`
   - Textures: ≤ 1K on mobile (2K only for hero surfaces), WebP or KTX2. Keep normal maps linear (no sRGB).
3. Add a row to `public/CREDITS.md` *and* the asset manifest (below).
4. Load it with drei `useGLTF` / `useTexture` inside `<Suspense>`, so a missing file fails visibly in dev.

## Asset manifest (create with the first external asset)

`src/assets/manifest.ts`. One entry per asset:

```ts
{ id: 'concrete_worn', path: '/textures/concrete_worn/', source: 'ambientCG Concrete034', license: 'CC0',
  url: 'https://ambientcg.com/view?id=Concrete034', scale: 1, maps: ['color','normal','roughness'],
  resolution: '1K', optimized: true, addedBy: '…', date: '2026-…' }
```

The check script should verify that every manifest path exists on disk and every file in `public/` is in the manifest. Add that when the manifest is created.
