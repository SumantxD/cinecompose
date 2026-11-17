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

## Episode surfaces and head attachments

The episode locally vendors **Poly Haven `old_wood_floor`, `damaged_plaster`, and `denim_fabric` (CC0)**. Each includes color, tangent normal, and roughness maps: PBR 1K, locally converted WebP, with original download URLs, JPEG hashes and converted-file sizes in `public/textures/provenance.json`. `SurfaceTextures` shares resources, loads a kind only when requested, and retains procedural materials if the download fails. Measured linear-RGB albedo means from the local maps normalize the old dark tints to the procedural reference reflectance (0.55); tint gains are applied once to preserved base colors, not repeatedly and not as a global exposure increase. Color maps are sRGB; normal/roughness maps stay linear. The independent Character Lab does not fetch these scene surfaces.

`HeadDetails` supplies the canonical short-hair, braided-child, and driver cap/beard attachments in normalized head-local coordinates. Its extension slot is for a separately licensed, correctly scaled attachment—not arbitrary-body-GLB retargeting. No scanned hair/head model is currently vendored. A future model requires role-specific licensing, scale, style and close-up review; Meera is not a scaled adult asset. The existing scene characters stay procedural and are not claimed to be photorealistic or final close-up actors.

`npm run check` now runs `scripts/check-assets.mjs` (local files and license/provenance), plus the library export and immutable rendered-frame guard. The browser scene audit is `node scripts/audit-scenes.mjs http://localhost:5173/ /tmp/kaali-audit-1` (optional final argument: comma-separated scene ids). It uses `agent-browser` to obtain Chrome's CDP endpoint and never overwrites a completed report. Review the resulting images as well as the structural report; clear sightlines do not prove good composition or natural-looking people.

## Character motion pack

`public/animations/kaali-raat-cc0.glb` bundles 35 motion clips from the KinemIQ **free-game-animations** v1.0 source (original motion: Quaternius), under **CC0 1.0**. Keep their transform hierarchy and clips; the source mannequin is not redistributed. The exact source/license and included license text live in `public/CREDITS.md` and `public/animations/`.

The pack is a Character Lab authoring asset, not a character or episode-actor replacement. `AnimationLibrary` loads it on demand for licensed motion only, then retargets its verified hierarchy onto the shared 18-bone procedural rig and samples explicit clip time. It is not a generic user-GLB import system. Validate additions and inspect representative rendered motion, rather than accepting clip count or bone metadata alone.

Rebuild from the verified source directory with `node scripts/prepare-animation-pack.mjs <source-directory>`. The script generates the pack, `public/animations/kaali-raat-cc0.meta.json`, and `src/characters/animation-source.ts` together. Each new source version needs its license recorded before commit, plus a re-import and rendered-motion check.
