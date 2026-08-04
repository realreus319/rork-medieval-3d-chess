from pathlib import Path


def edit(path: str, replacements: list[tuple[str, str]]) -> None:
    target = Path(path)
    text = target.read_text()
    for old, new in replacements:
        if old not in text:
            raise SystemExit(f"pattern not found in {path}: {old[:120]!r}")
        text = text.replace(old, new, 1)
    target.write_text(text)


edit("web/src/xiangqi/cinematicController.ts", [
    ('  elephant: "r",', '  elephant: "e",'),
])

edit("web/src/xiangqi/cinematicController.test.ts", [
    ('expect(controller.pieceAt("e10")).toEqual({ kind: "k", color: "w" });', 'expect(controller.pieceAt("e1")).toEqual({ kind: "k", color: "w" });'),
    ('expect(controller.pieceAt("b8")).toEqual({ kind: "q", color: "w" });', 'expect(controller.pieceAt("b3")).toEqual({ kind: "q", color: "w" });\n    expect(controller.pieceAt("c1")).toEqual({ kind: "e", color: "w" });'),
    ('expect(controller.pieceAt("a7")).toEqual({ kind: "p", color: "w" });', 'expect(controller.pieceAt("a4")).toEqual({ kind: "p", color: "w" });'),
    ('expect(controller.legalTargets("a7")).toContainEqual({\n      to: "a6",', 'expect(controller.legalTargets("a4")).toContainEqual({\n      to: "a5",'),
    ('await expect(controller.tryMove("a7", "a6")).resolves.toBe(true);', 'await expect(controller.tryMove("a4", "a5")).resolves.toBe(true);'),
    ('from: "a7",\n      to: "a6",', 'from: "a4",\n      to: "a5",'),
    ('expect(controller.getSnapshot().lastMove).toEqual({ from: "a7", to: "a6" });', 'expect(controller.getSnapshot().lastMove).toEqual({ from: "a4", to: "a5" });'),
])

edit("web/src/ui/GameShell.tsx", [
    ('  const [locale, setLocale] = useState<Locale>(readStoredLocale);\n', '  const [locale, setLocale] = useState<Locale>(readStoredLocale);\n  const localeRef = useRef<Locale>(locale);\n'),
    ('  useEffect(() => {\n    const copy = UI_COPY[locale];', '  useEffect(() => {\n    localeRef.current = locale;\n    const copy = UI_COPY[locale];'),
    ('            setNotice(locale === "zh-CN" ? `为保持流畅，画质已自动调整为 ${quality}` : `Graphics adjusted to ${quality}`);', '            setNotice(localeRef.current === "zh-CN" ? `为保持流畅，画质已自动调整为 ${quality}` : `Graphics adjusted to ${quality}`);'),
    ('  }, [controller, detected, initialSettings, locale]);', '  }, [controller, detected, initialSettings]);'),
])

edit("web/src/assets/generated.ts", [
    ('export const DEATH_CRY_URLS: Record<Faction, Record<PieceKind, string>> = {', 'export const DEATH_CRY_URLS: Record<Faction, Partial<Record<PieceKind, string>>> = {'),
])

edit("web/src/audio/audioManager.ts", [
    ('const kinds: PieceKind[] = ["k", "q", "b", "n", "r", "p"];', 'const kinds: PieceKind[] = ["k", "q", "b", "e", "n", "r", "p"];'),
    ('const url = DEATH_CRY_URLS[faction]?.[kind];', 'const url = DEATH_CRY_URLS[faction]?.[kind === "e" ? "b" : kind];'),
])

edit("web/src/scene/weapons.ts", [
    ('    b: { main: "crystalStaff" },\n    n:', '    b: { main: "crystalStaff" },\n    e: { main: "warhammer", off: "roundShield" },\n    n:'),
    ('    b: { main: "serpentStaff" },\n    n:', '    b: { main: "serpentStaff" },\n    e: { main: "stoneMaul", off: "chimalli" },\n    n:'),
])

edit("web/src/scene/rankBadges.ts", [
    ('  b: 0.36,\n  r:', '  b: 0.36,\n  e: 0.4,\n  r:'),
    ('function bishopGlyph(ctx: CanvasRenderingContext2D): void {', '''function elephantGlyph(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.ellipse(35, 40, 13, 17, -0.18, 0, Math.PI * 2);
  ctx.ellipse(65, 40, 13, 17, 0.18, 0, Math.PI * 2);
  ctx.moveTo(50, 22);
  ctx.bezierCurveTo(36, 22, 34, 45, 43, 55);
  ctx.lineTo(45, 69);
  ctx.quadraticCurveTo(50, 78, 55, 69);
  ctx.lineTo(57, 55);
  ctx.bezierCurveTo(66, 45, 64, 22, 50, 22);
  ctx.closePath();
  ctx.moveTo(41, 53);
  ctx.quadraticCurveTo(31, 60, 37, 69);
  ctx.quadraticCurveTo(38, 61, 46, 58);
  ctx.closePath();
  ctx.moveTo(59, 53);
  ctx.quadraticCurveTo(69, 60, 63, 69);
  ctx.quadraticCurveTo(62, 61, 54, 58);
  ctx.closePath();
  pedestal(ctx, 75);
}

function bishopGlyph(ctx: CanvasRenderingContext2D): void {'''),
    ('  b: bishopGlyph,\n  q:', '  b: bishopGlyph,\n  e: elephantGlyph,\n  q:'),
    ('  b: 0.72,\n  r:', '  b: 0.72,\n  e: 0.78,\n  r:'),
])

edit("web/src/scene/sceneEngine.ts", [
    ('  b: { volume: 0.92, rate: 1 },\n  n:', '  b: { volume: 0.92, rate: 1 },\n  e: { volume: 0.98, rate: 0.94 },\n  n:'),
    ('  b: 0.52,\n  n:', '  b: 0.52,\n  e: 0.72,\n  n:'),
    ('  b: { stepsPerTile: 1.9, cadence: 2.45, timbre: "leather", volume: 0.78 },\n  n:', '  b: { stepsPerTile: 1.9, cadence: 2.45, timbre: "leather", volume: 0.78 },\n  e: { stepsPerTile: 1.65, cadence: 2.05, timbre: "plate", volume: 0.94 },\n  n:'),
    ('  // Plate and a hammer: slow in, and the stone takes most of the blow.\n  r:', '''  // Elephant/minister: a ceremonial guardian with a jade ground wave.
  e: {
    zoom: 7.4,
    charge: 1.15,
    wind: 0.2,
    power: 1.5,
    swing: 0.82,
    heft: 0.72,
    slash: null,
    wave: { radius: 2.6, color: 0x76d6b3 },
    pillar: null,
    wake: false,
    aftershock: 0.18,
    hold: 0.07,
  },
  // Plate and a hammer: slow in, and the stone takes most of the blow.
  r:'''),
    ('const heavy = piece.kind === "k" || piece.kind === "q" || piece.kind === "r";', 'const heavy = piece.kind === "k" || piece.kind === "q" || piece.kind === "r" || piece.kind === "e";'),
])

edit("web/src/scene/pieces.ts", [
    ('  b: 0.88,\n  r:', '  b: 0.88,\n  e: 0.92,\n  r:'),
    ('    const kinds = Object.keys(PIECE_MODEL_URLS.w) as PieceKind[];', '    const kinds: PieceKind[] = ["p", "n", "b", "e", "r", "q", "k"];'),
    ('      for (const kind of kinds) {\n        // Only load a second roster where the faction really owns a sculpt.', '      for (const kind of kinds) {\n        if (kind === "e") continue;\n        // Only load a second roster where the faction really owns a sculpt.'),
    ('\n    // Anything still missing borrows the other army\'s figure.\n', '''
    // Xiangqi needs a seventh visual role. Elephant has its own template key,
    // animations and overlays while borrowing the advisor skeleton as a base.
    for (const faction of factions) {
      const advisor = this.templates.get(`${faction}b`);
      if (advisor) {
        this.templates.set(`${faction}e`, { ...advisor, clips: advisor.clips });
        const source = this.clipSources.get(`${faction}b`);
        if (source) this.clipSources.set(`${faction}e`, source);
      }
    }

    // Anything still missing borrows the other army's figure.
'''),
    ('    model.scale.setScalar(template.scale);\n    model.position.copy(template.offset);', '    if (kind === "e") decorateElephantGuardian(model, color, template.unit, template.baseY);\n    model.scale.setScalar(template.scale);\n    model.position.copy(template.offset);'),
    ('export function buildProceduralFigure(kind: PieceKind): THREE.Object3D {', '''function decorateElephantGuardian(model: THREE.Object3D, color: Faction, unit: number, baseY: number): void {
  const regalia = new THREE.Group();
  regalia.name = `xiangqi_elephant_regalia_${color}`;
  const jade = new THREE.MeshStandardMaterial({
    color: color === "w" ? 0x77c7b0 : 0x2fae91,
    roughness: 0.28,
    metalness: 0.35,
    emissive: color === "w" ? 0x123d39 : 0x0b332c,
    emissiveIntensity: 0.55,
  });
  const gold = new THREE.MeshStandardMaterial({
    color: color === "w" ? 0xe3c875 : 0xc88635,
    roughness: 0.24,
    metalness: 0.9,
    emissive: 0x2a1804,
    emissiveIntensity: 0.3,
  });
  const y = baseY + unit * 0.68;
  const halo = new THREE.Mesh(new THREE.TorusGeometry(unit * 0.19, unit * 0.028, 10, 32), jade);
  halo.position.set(0, y, -unit * 0.075);
  regalia.add(halo);
  const brow = new THREE.Mesh(new THREE.SphereGeometry(unit * 0.105, 18, 12), gold);
  brow.scale.set(1.35, 0.65, 0.55);
  brow.position.set(0, y + unit * 0.07, unit * 0.08);
  regalia.add(brow);
  for (const side of [-1, 1]) {
    const tusk = new THREE.Mesh(new THREE.ConeGeometry(unit * 0.026, unit * 0.19, 12), gold);
    tusk.position.set(side * unit * 0.105, y - unit * 0.03, unit * 0.11);
    tusk.rotation.z = side * 0.62;
    tusk.rotation.x = Math.PI * 0.52;
    regalia.add(tusk);
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(unit * 0.1, 16, 10), jade);
    shoulder.scale.set(1.25, 0.55, 0.8);
    shoulder.position.set(side * unit * 0.2, y - unit * 0.14, 0);
    regalia.add(shoulder);
  }
  model.add(regalia);
}

export function buildProceduralFigure(kind: PieceKind): THREE.Object3D {'''),
    ('  if (kind === "b") {\n    const hood', '  if (kind === "e") {\n    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 10, 28), stone);\n    halo.position.set(0, 0.72, -0.08);\n    group.add(halo);\n    for (const side of [-1, 1]) {\n      const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.18, 10), stone);\n      tusk.position.set(side * 0.11, 0.7, 0.13);\n      tusk.rotation.z = side * 0.6;\n      tusk.rotation.x = Math.PI / 2;\n      group.add(tusk);\n    }\n  }\n  if (kind === "b") {\n    const hood'),
])
