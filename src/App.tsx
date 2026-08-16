import { useEffect, useRef, useState } from 'react'
import {
  BASE,
  CELL,
  DECOR,
  GAPS,
  ZONES,
  assignBaseSlots,
  dist,
  isFree,
  lerp,
  planRoute,
  type Node,
} from './nav'

type ModelKind =
  | 'scrubber'
  | 'delivery'
  | 'humanoid'
  | 'security'
  | 'wheelchair'
  | 'suitcase'
  | 'stroller'
  | 'quadruped'

type Agent = {
  id: string
  name: string
  cls: 'A' | 'B'
  governable: boolean
  task: string
  height: string
  footprint: string
  weight: string
  speed: string
  sensors: string
  nav: string
  reads: string
  deploy: string
  color: string
  size: number
  speedMs: number 
  model: ModelKind
  home: Node
  x: number
  y: number
  heading: number
  active: boolean
  selected: boolean
  goal: Node | null
  route: Node[]
  routeIndex: number
  status: 'STANDBY' | 'IN TRANSITO' | 'CEDE (P.3)' | 'SCANSIONE (L.2)' | 'ARRIVATO' | 'PULIZIA IN CORSO' | 'OPERATIVO SUL POSTO' | 'ASSISTENZA PASSEGGERI' | 'PATTUGLIA FISSA' | 'NESSUN PERCORSO' | 'RITORNO ALLA BASE' | 'IN CARICA'
  blockedFor: number
  battery: number
  idleTimer: number
}

type InspectorData = {
  id: string
  name: string
  cls: 'A' | 'B'
  governable: boolean
  task: string
  color: string
  x: number
  y: number
  height: string
  footprint: string
  weight: string
  speed: string
  sensors: string
  nav: string
  reads: string
  deploy: string
  active: boolean
  status: Agent['status']
  remaining: number
  battery: number
} | null

type AgentSpec = Omit<
  Agent,
  | 'home'
  | 'x'
  | 'y'
  | 'heading'
  | 'active'
  | 'selected'
  | 'goal'
  | 'route'
  | 'routeIndex'
  | 'status'
  | 'blockedFor'
  | 'battery'
  | 'idleTimer'
>

const ROSTER: AgentSpec[] = [
  {
    id: 'A.01',
    name: 'TENNANT T7AMR',
    cls: 'A',
    governable: true,
    task: 'Pulizia (ride-on scrubber)',
    height: '145 cm',
    footprint: '165 × 85 cm',
    weight: '492 kg',
    speed: '~0,5–1 m/s',
    sensors: 'Array 3D ambiente + LiDAR (BrainOS)',
    nav: 'BrainOS · teach-and-repeat',
    reads: 'Z0',
    deploy: 'Aeroporti / grandi superfici',
    color: '#00FFFF',
    size: 1.65,
    speedMs: 0.75,
    model: 'scrubber',
  },
  {
    id: 'A.02',
    name: 'AVIDBOTS NEO 2',
    cls: 'A',
    governable: true,
    task: 'Pulizia (scrubber autonomo)',
    height: '~140 cm',
    footprint: '~150 × 80 cm',
    weight: '≤ 688 kg',
    speed: '1,35 m/s',
    sensors: '14 sensori · LiDAR 360° + camere 3D 270°',
    nav: 'SLAM',
    reads: 'Z0 · Z1',
    deploy: 'Aeroporti',
    color: '#00E0C0',
    size: 1.5,
    speedMs: 1.35,
    model: 'scrubber',
  },
  {
    id: 'A.03',
    name: 'OTTOBOT 2.0',
    cls: 'A',
    governable: true,
    task: 'Logistica / consegna',
    height: '~100 cm',
    footprint: '~70 × 70 cm',
    weight: '—',
    speed: '1,67 m/s (6 km/h)',
    sensors: 'LiDAR 3D 360° (Ouster) + camere + ultrasuoni + cliff',
    nav: 'SLAM · 4-wheel swerve',
    reads: 'Z0 · Z1',
    deploy: 'Aeroporti',
    color: '#3AA0FF',
    size: 0.7,
    speedMs: 1.67,
    model: 'delivery',
  },
  {
    id: 'A.04',
    name: 'UNITREE G1',
    cls: 'A',
    governable: true,
    task: 'Manipolazione',
    height: '132 cm',
    footprint: '~40 cm (piedi, ripiegabile)',
    weight: '35 kg',
    speed: '2,0 m/s',
    sensors: 'Livox MID-360 LiDAR 3D + Intel RealSense D435 (depth)',
    nav: 'LiDAR SLAM + depth',
    reads: 'Z0 · Z1 · Z2',
    deploy: 'Trial',
    color: '#7B61FF',
    size: 0.4,
    speedMs: 2.0,
    model: 'humanoid',
  },
  {
    id: 'A.05',
    name: 'UNITREE H1',
    cls: 'A',
    governable: true,
    task: 'Informazione / guida',
    height: '180 cm',
    footprint: '~45 cm',
    weight: '~47 kg',
    speed: '—',
    sensors: 'LiDAR 3D + depth',
    nav: 'LiDAR SLAM + depth',
    reads: 'Z0 · Z1 · Z2',
    deploy: 'Trial',
    color: '#B36BFF',
    size: 0.45,
    speedMs: 1.5,
    model: 'humanoid',
  },
  {
    id: 'A.06',
    name: 'KNIGHTSCOPE K5',
    cls: 'A',
    governable: true,
    task: 'Sicurezza / pattuglia',
    height: '164 cm',
    footprint: '113 × 89 cm',
    weight: '190 kg',
    speed: '1,33 m/s (4,8 km/h)',
    sensors: '4× camere 4K/HD + termica + 6× LiDAR + 13× sonar',
    nav: 'Pattuglia autonoma · SLAM',
    reads: 'Z0 · Z1 · Z2',
    deploy: 'Spazi pubblici',
    color: '#FF3B6B',
    size: 1.13,
    speedMs: 1.33,
    model: 'security',
  },
  {
    id: 'B.01',
    name: 'WHILL AUTONOMOUS',
    cls: 'B',
    governable: false,
    task: 'Mobilità assistita PRM (sedia a rotelle)',
    height: '~90 cm (seduta ~74)',
    footprint: '~99 × 55 cm',
    weight: '—',
    speed: '~1,2 m/s (passo pedonale)',
    sensors: 'LiDAR + camere + sensori 360° · stop automatico',
    nav: 'Autonoma / assistita',
    reads: 'Z0 · Z1',
    deploy: 'Aeroporti',
    color: '#FFD400',
    size: 0.99,
    speedMs: 1.2,
    model: 'wheelchair',
  },
  {
    id: 'B.02',
    name: 'AIRWHEEL SR5',
    cls: 'B',
    governable: false,
    task: 'Logistica passeggero (valigia auto-segue)',
    height: '55 cm',
    footprint: '38 × 21 cm',
    weight: '4,5 kg',
    speed: '0,56–1,67 m/s (2–6 km/h)',
    sensors: 'UWB + ultrasuoni + IR + camera 160°',
    nav: 'Follow-me (UWB) + anti-ostacolo',
    reads: 'Z0 (UWB: insegue il padrone, non legge il pavimento)',
    deploy: 'Consumer',
    color: '#FF9500',
    size: 0.38,
    speedMs: 1.1,
    model: 'suitcase',
  },
  {
    id: 'B.03',
    name: 'GLÜXKIND ELLA',
    cls: 'B',
    governable: false,
    task: 'Mobilità famiglia (passeggino smart)',
    height: '~100 cm',
    footprint: '~90 × 60 cm',
    weight: '13,6 kg',
    speed: '1,78 m/s (6,4 km/h)',
    sensors: 'Sensori 360° + camere perimetrali',
    nav: 'Guida assistita / freno automatico',
    reads: 'Z0 · Z1',
    deploy: 'Consumer',
    color: '#7CFF6B',
    size: 0.9,
    speedMs: 1.78,
    model: 'stroller',
  },
  {
    id: 'B.04',
    name: 'ROBOT-GUIDA QUADRUPEDE',
    cls: 'B',
    governable: false,
    task: 'Assistenza speciale (cane-guida robotico)',
    height: '~40 cm',
    footprint: '~70 × 30 cm',
    weight: '~15 kg',
    speed: '—',
    sensors: 'LiDAR 4D + camere',
    nav: 'Zampe · segue percorso + anti-ostacolo',
    reads: 'Z0',
    deploy: 'Candidato: Unitree Go2',
    color: '#FF6BE1',
    size: 0.7,
    speedMs: 1.2,
    model: 'quadruped',
  },
]

const POI = {
  BAGGAGE_CLAIM: { x: -140, y: 225 },
  WAYSTATION: { x: 12, y: -140 }     
};

const MISSIONS = [
  { id: 'A.01', start: { x: -4.5, y: -150 }, to: { x: -4.5, y: 150 }, label: 'Molo Nord -> Sud' },
  { id: 'A.03', start: { x: 150, y: -4.5 }, to: { x: -150, y: -4.5 }, label: 'Molo Est -> Ovest' },
]

const getPriority = (id: string) => {
  if (['B.01', 'B.03', 'B.04'].includes(id)) return 1;
  if (id === 'A.06') return 2;
  if (['A.03', 'A.04', 'A.05'].includes(id)) return 3;
  if (['A.01', 'A.02'].includes(id)) return 4;
  if (id === 'B.02') return 5;
  return 5;
};

type SignType = 'L.1' | 'L.2' | 'P.1' | 'P.2' | 'P.3' | 'C.1' | 'C.2';
type SignDef = { id: string; type: SignType; x: number; y: number; w: number; h: number; dir?: number; cost?: number; alpha?: number; style?: 'line' | 'dome' };

const LANE_W = 3
const WAIT_D = 1
const THRESH_D = 0.6
const TONE_MISTA = 0.176
const TONE_OPERATIVA = 0.341
const HAZARD_D = THRESH_D

function dualLaneCorridor(
  id: string,
  axis: 'v' | 'h',
  start: number,
  end: number,
  center: number,
  width: number,
  dirA: number,
  dirB: number,
  cost = 0.4,
): SignDef[] {
  const half = width / 2
  const aOuter = center - half
  const aInner = aOuter + LANE_W
  const bInner = center + half - LANE_W
  const len = end - start
  const seg = (cross: number, size: number) =>
    axis === 'v' ? { x: cross, y: start, w: size, h: len } : { x: start, y: cross, w: len, h: size }
  return [
    { id: `${id}_A`, type: 'L.1', ...seg(aOuter, LANE_W), dir: dirA, cost },
    { id: `${id}_B`, type: 'L.1', ...seg(bInner, LANE_W), dir: dirB, cost },
    { id: `${id}_L2_2`, type: 'L.2', ...seg(aInner, THRESH_D), style: 'line' },
    { id: `${id}_L2_3`, type: 'L.2', ...seg(bInner - THRESH_D, THRESH_D), style: 'line' },
  ]
}

const GRAMMAR: SignDef[] = [
  ...dualLaneCorridor('molo_sud', 'v', 20, 60, 0, 12, 1, -1),
  ...dualLaneCorridor('molo_nord', 'v', -280, -20, 0, 12, 1, -1),
  ...dualLaneCorridor('molo_ovest', 'h', -280, -20, 0, 12, -1, 1),
  ...dualLaneCorridor('molo_est', 'h', 20, 280, 0, 12, -1, 1),

  { id: 'L2_emerg_hub_ovest', type: 'L.2', x: -20 - THRESH_D, y: -6, w: THRESH_D, h: 12 },
  { id: 'L2_emerg_hub_est', type: 'L.2', x: 20, y: -6, w: THRESH_D, h: 12 },
  { id: 'L2_emerg_hub_sud', type: 'L.2', x: -6, y: 20, w: 12, h: THRESH_D },
  { id: 'L2_emerg_hub_nord', type: 'L.2', x: -6, y: -20 - THRESH_D, w: 12, h: THRESH_D },

  { id: 'C1_hub_mista', type: 'C.1', x: -20, y: -20, w: 40, h: 40, alpha: TONE_MISTA },

  { id: 'hub_loop_n', type: 'L.1', x: -20, y: -20, w: 40, h: LANE_W, dir: -1, cost: 0.4 },
  { id: 'hub_loop_s', type: 'L.1', x: -20, y: 17, w: 40, h: LANE_W, dir: 1, cost: 0.4 },
  { id: 'hub_loop_e', type: 'L.1', x: 17, y: -17, w: LANE_W, h: 34, dir: -1, cost: 0.4 },
  { id: 'hub_loop_w', type: 'L.1', x: -20, y: -17, w: LANE_W, h: 34, dir: 1, cost: 0.4 },

  { id: 'hub_loop_L2_n', type: 'L.2', x: -17 + THRESH_D / 2, y: -17, w: 34 - THRESH_D, h: THRESH_D, style: 'line' },
  { id: 'hub_loop_L2_s', type: 'L.2', x: -17 + THRESH_D / 2, y: 17 - THRESH_D, w: 34 - THRESH_D, h: THRESH_D, style: 'line' },
  { id: 'hub_loop_L2_e', type: 'L.2', x: 17 - THRESH_D, y: -17 + THRESH_D / 2, w: THRESH_D, h: 34 - THRESH_D, style: 'line' },
  { id: 'hub_loop_L2_w', type: 'L.2', x: -17, y: -17 + THRESH_D / 2, w: THRESH_D, h: 34 - THRESH_D, style: 'line' },

  { id: 'P3_hub_yield_nord', type: 'P.3', x: -6, y: -20 - WAIT_D, w: LANE_W, h: WAIT_D },
  { id: 'P2_hub_in_nord', type: 'P.2', x: -6, y: -20, w: LANE_W, h: LANE_W },
  { id: 'P2_hub_out_nord', type: 'P.2', x: 3, y: -20, w: LANE_W, h: LANE_W },

  { id: 'P3_hub_yield_sud', type: 'P.3', x: 3, y: 20, w: LANE_W, h: WAIT_D },
  { id: 'P2_hub_in_sud', type: 'P.2', x: 3, y: 17, w: LANE_W, h: LANE_W },
  { id: 'P2_hub_out_sud', type: 'P.2', x: -6, y: 17, w: LANE_W, h: LANE_W },

  { id: 'P3_hub_yield_ovest', type: 'P.3', x: -20 - WAIT_D, y: 3, w: WAIT_D, h: LANE_W },
  { id: 'P2_hub_in_ovest', type: 'P.2', x: -20, y: 3, w: LANE_W, h: LANE_W },
  { id: 'P2_hub_out_ovest', type: 'P.2', x: -20, y: -6, w: LANE_W, h: LANE_W },

  { id: 'P3_hub_yield_est', type: 'P.3', x: 20, y: -6, w: WAIT_D, h: LANE_W },
  { id: 'P2_hub_in_est', type: 'P.2', x: 17, y: -6, w: LANE_W, h: LANE_W },
  { id: 'P2_hub_out_est', type: 'P.2', x: 17, y: 3, w: LANE_W, h: LANE_W },
];

const UNITS_PER_M = 1
const FPS = 60
const unitsPerFrame = (ms: number, timeScale: number) => (ms * UNITS_PER_M * timeScale) / FPS
const TIME_SCALES = [1, 4, 10, 30]

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function createAgents(): Agent[] {
  const slots = assignBaseSlots(ROSTER.map((s) => ({ id: s.id, radius: s.size / 2 })))
  const fallback = { x: BASE.x + BASE.w / 2, y: BASE.y + BASE.h / 2 }
  return ROSTER.map((spec) => ({
    ...spec,
    home: slots[spec.id] ?? fallback,
    x: (slots[spec.id] ?? fallback).x,
    y: (slots[spec.id] ?? fallback).y,
    heading: -Math.PI / 2,
    active: false,
    selected: false,
    goal: null,
    route: [],
    routeIndex: 0,
    status: 'STANDBY' as const,
    blockedFor: 0,
    battery: 100,
    idleTimer: 0,
  }))
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[var(--gray-color)] font-sans">{label}:</span>
      <span className="text-right font-mono">{value}</span>
    </div>
  )
}

export default function App() {
  const [bootStage, setBootStage] = useState(0)
  const [logoText, setLogoText] = useState('')
  const [descText, setDescText] = useState('')

  const targetLogo = '[GROUND CONTROL]'
  const targetDesc = 'SIMULATORE VIRTUALE DELLA GRAMMATICA VISIVA UOMO-MACCHINA · MANUALE GROUND CONTROL'

  // Audio state - Pure silent control room with hard tactical clicks
  const [isMuted, setIsMuted] = useState(false)
  const isMutedRef = useRef(isMuted)
  isMutedRef.current = isMuted
  const audioCtxRef = useRef<AudioContext | null>(null)

  const playClickSound = () => {
    if (isMutedRef.current) return
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') {
        ctx.resume()
      }
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(1400, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.018)
      
      gain.gain.setValueAtTime(0.06, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.018)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.018)
    } catch (e) {}
  }

  useEffect(() => {
    let i = 0
    const logoTimer = setInterval(() => {
      if (i <= targetLogo.length) {
        setLogoText(targetLogo.slice(0, i))
        i++
      } else {
        clearInterval(logoTimer)
        setBootStage(1)
      }
    }, 60)
    return () => clearInterval(logoTimer)
  }, [])

  useEffect(() => {
    if (bootStage === 1) {
      let j = 0
      const descTimer = setInterval(() => {
        if (j <= targetDesc.length) {
          setDescText(targetDesc.slice(0, j))
          j++
        } else {
          clearInterval(descTimer)
          let stage = 2
          const blockTimer = setInterval(() => {
            setBootStage(stage)
            stage++
            if (stage > 9) clearInterval(blockTimer)
          }, 180)
        }
      }, 15)
      return () => clearInterval(descTimer)
    }
  }, [bootStage])

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [inspector, setInspector] = useState<InspectorData>(null)
  const [log, setLog] = useState<string[]>(['Boot sistema…'])
  const [activeRoom, setActiveRoom] = useState<string | null>(null)
  const hoveredZoneRef = useRef<string | null>(null)
  const [timeScale, setTimeScale] = useState(TIME_SCALES[1])
  const timeScaleRef = useRef(timeScale)
  timeScaleRef.current = timeScale

  const [grammarOn, setGrammarOn] = useState(false)
  const grammarOnRef = useRef(grammarOn)
  const [laneUsage, setLaneUsage] = useState<number | null>(null)
  const forceReplan = useRef(false);

  const [isFleetPanelOpen, setIsFleetPanelOpen] = useState(false)
  const agentsToStartRef = useRef<Set<string>>(new Set())
  const agentToFollowRef = useRef<string | null>(null)
  const [followedAgentId, setFollowedAgentId] = useState<string | null>(null)
  const simStartedRef = useRef(false)

  const pushLog = useRef((line: string) => {
    setLog((prev) => [...prev.slice(-40), line])
  })

  useEffect(() => {
    if (bootStage < 9) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const COST_SIGNS = GRAMMAR.filter(g => g.type === 'C.1' || g.type === 'C.2' || g.type === 'L.1');
    const P2_SIGNS = GRAMMAR.filter(g => g.type === 'P.2');
    const P3_SIGNS = GRAMMAR.filter(g => g.type === 'P.3');
    const L2_THRESHOLDS = GRAMMAR.filter(g => g.type === 'L.2' && g.style !== 'line');

    const getGrammarCost = (x: number, y: number, dx: number, dy: number) => {
      if (!grammarOnRef.current) return 1.0;
      let finalCost = 2.0; 

      const inHubCore = x >= -17 && x <= 17 && y >= -17 && y <= 17;
      const inHub = x >= -20 && x <= 20 && y >= -20 && y <= 20;

      if (inHubCore) {
          finalCost = 5.0; 
      } else if (inHub) {
          finalCost = 0.5; 
      }

      let inLane = false;
      for (const g of COST_SIGNS) {
        if (g.type === 'C.1' && g.id !== 'C1_hub_mista') {
          if (x >= g.x && x <= g.x + g.w && y >= g.y && y <= g.y + g.h) {
            finalCost = Math.max(finalCost, 5.0);
          }
        }
        if (g.type === 'L.1') {
          if (x >= g.x - 0.5 && x <= g.x + g.w + 0.5 && y >= g.y - 0.5 && y <= g.y + g.h + 0.5) {
            inLane = true;
            const isHoriz = g.w > g.h;
            const laneDx = isHoriz ? (g.dir || 1) : 0;
            const laneDy = isHoriz ? 0 : (g.dir || 1);
            
            const len = Math.hypot(dx, dy) || 1;
            const dot = (dx / len) * laneDx + (dy / len) * laneDy;
            
            const center = isHoriz ? g.y + g.h / 2 : g.x + g.w / 2;
            const pos = isHoriz ? y : x;
            const distFromCenter = Math.abs(pos - center);

            if (dot > 0.5) {
              if (distFromCenter <= 0.5) finalCost = 0.1; 
              else finalCost = 0.5; 
            } else if (dot < -0.5) {
              finalCost = 20.0;
            } else {
              finalCost = 1.0;
            }
          }
        }
      }
      
      if (!inLane && !inHub) {
         finalCost = Math.max(finalCost, 2.0); 
      }
      return finalCost;
    };

    const agents = createAgents()
    const say = pushLog.current

    const minX = Math.min(...ZONES.map((z) => z.x))
    const maxX = Math.max(...ZONES.map((z) => z.x + z.w))
    const minY = Math.min(...ZONES.map((z) => z.y))
    const maxY = Math.max(...ZONES.map((z) => z.y + z.h))
    const mapWidth = maxX - minX
    const mapHeight = maxY - minY
    const mapCenterX = minX + mapWidth / 2
    const mapCenterY = minY + mapHeight / 2

    say(`Roster caricato · ${agents.length} entità.`)
    say('Attivazione ecosistema: direzionalità stretta e fila indiana sicura.')

    agents.forEach((agent, idx) => {
      const mission = MISSIONS.find(m => m.id === agent.id);
      
      if (agent.cls === 'B') {
        agent.active = false; 
        agent.x = 0;
        agent.y = 0;
        agent.battery = 100;
        agent.route = [];
        agent.routeIndex = 0;
        agent.status = 'STANDBY';
        agent.goal = null;
      } else {
        agent.active = true;
        agent.x = agent.home.x;
        agent.y = agent.home.y;
        agent.battery = 100;
        agent.route = [];
        agent.routeIndex = 0;
        agent.status = 'STANDBY';
        
        if (mission) {
          agent.goal = { ...mission.to };
        } else {
          agent.goal = null;
          agent.idleTimer = 120 + idx * 180;
        }
      }
    });

    const cam = {
      x: mapCenterX,
      y: mapCenterY,
      zoom: 1,
      targetX: mapCenterX,
      targetY: mapCenterY,
      targetZoom: 1,
      isZoomed: false,
      followingAgent: null as Agent | null,
    }

    const mouse = { x: 0, y: 0 }
    let frameCount = 0
    const perf = { cost: 0, fps: 0 }
    let lastFrameAt = 0
    let hovered: Agent | null = null
    let inspectorTick = 0
    let lastSelected: (typeof agents)[number] | null = null
    let raf = 0

    const getFitZoom = () =>
      Math.min(canvas.clientWidth / (mapWidth + 40), canvas.clientHeight / (mapHeight + 40))

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = canvas.clientWidth * dpr
      canvas.height = canvas.clientHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (!cam.isZoomed && !cam.followingAgent) {
        cam.targetZoom = getFitZoom()
        cam.zoom = cam.targetZoom
      }
    }

    const startZoom = getFitZoom()
    cam.zoom = startZoom
    cam.targetZoom = startZoom
    resize()

    const toWorld = (mx: number, my: number) => ({
      x: (mx - canvas.clientWidth / 2) / cam.zoom + cam.x,
      y: (my - canvas.clientHeight / 2) / cam.zoom + cam.y,
    })

    const findZoneAt = (x: number, y: number) => {
      for (const zone of ZONES) {
        if (x >= zone.x && x <= zone.x + zone.w && y >= zone.y && y <= zone.y + zone.h) {
          return zone.id
        }
      }
      return null
    }

    const pickRadius = (a: Agent) => Math.max(a.size, 10 / cam.zoom)

    const updateAgents = (frozen: boolean) => {
      if (agentsToStartRef.current.size > 0) {
        simStartedRef.current = true;
        agentsToStartRef.current.forEach(id => {
          const agent = agents.find(a => a.id === id);
          if (agent) {
            agent.active = true;
            
            if (agent.cls === 'B' && !agent.route.length && agent.status === 'STANDBY') {
              agent.x = (Math.random() - 0.5) * 100;
              agent.y = 210 + Math.random() * 40;
            }

            const mission = MISSIONS.find(m => m.id === id);
            if (mission) {
              agent.goal = { ...mission.to };
            } else if (!agent.goal) {
              const dests = [
                { x: -140, y: 225 },
                { x: 0, y: 80 },
                { x: -100, y: 80 },
                { x: 80, y: 80 }
              ];
              agent.goal = dests[Math.floor(Math.random() * dests.length)];
            }
            agent.status = 'IN TRANSITO';

            const clear = agent.size / 2 + 0.15;
            const blockers = agents.filter(o => o !== agent && o.active).map(o => ({ x: o.x, y: o.y, r: o.size / 2 }));
            const re = planRoute({ x: agent.x, y: agent.y }, agent.goal, clear, blockers, 0.35, getGrammarCost);
            if (re) {
              agent.route = re;
              agent.routeIndex = 1;
              agent.blockedFor = 0;
            }
            say(`Attivazione manuale: ${agent.id} (${agent.name})`);
          }
        });
        agentsToStartRef.current.clear();
      }

      // Spawno randomico controllato con missione e tempistica realistica per Classe B
      if (simStartedRef.current && !frozen && Math.random() < 0.0002) {
        const inactiveB = agents.find(a => a.cls === 'B' && !a.active);
        if (inactiveB) {
          inactiveB.active = true;
          inactiveB.x = -40 + (Math.random() - 0.5) * 30; 
          inactiveB.y = 240;    
          inactiveB.status = 'IN TRANSITO';
          
          const passengerDestinations = [
            { x: 0, y: -250 },  // Molo Nord / Gate
            { x: -250, y: 0 },  // Molo Ovest / Gate
            { x: 250, y: 0 },   // Molo Est / Gate
            { x: 0, y: 80 }     // Duty Free Plaza
          ];
          inactiveB.goal = passengerDestinations[Math.floor(Math.random() * passengerDestinations.length)];
          inactiveB.idleTimer = 200;

          const clear = inactiveB.size / 2 + 0.15;
          const blockers = agents.filter(o => o !== inactiveB && o.active).map(o => ({ x: o.x, y: o.y, r: o.size / 2 }));
          const route = planRoute({ x: inactiveB.x, y: inactiveB.y }, inactiveB.goal, clear, blockers, 0.35, getGrammarCost);
          if (route) {
            inactiveB.route = route;
            inactiveB.routeIndex = 1;
          }
          
          say(`Passeggero in transito: ${inactiveB.id} (${inactiveB.name}) entrato in Main Hall con rotta verso i Gate.`);
        }
      }

      if (forceReplan.current) {
        forceReplan.current = false;
        simStartedRef.current = true;
        
        agents.forEach(agent => {
          if (agent.active && agent.status === 'STANDBY') {
            const mission = MISSIONS.find(m => m.id === agent.id);
            if (mission) {
              agent.goal = { ...mission.to };
            } else if (!agent.goal) {
              const dests = [
                { x: -140, y: 225 },
                { x: 0, y: 80 },
                { x: -100, y: 80 },
                { x: 80, y: 80 }
              ];
              agent.goal = dests[Math.floor(Math.random() * dests.length)];
            }
            agent.status = 'IN TRANSITO';
          }
        });

        agents.filter(a => a.active && a.status !== 'IN CARICA' && a.goal).forEach(agent => {
          const clear = agent.size / 2 + 0.15;
          const blockers = agents.filter(o => o !== agent && o.active).map(o => ({ x: o.x, y: o.y, r: o.size / 2 }));
          const re = planRoute({ x: agent.x, y: agent.y }, agent.goal!, clear, blockers, 0.35, getGrammarCost);
          if (re) {
            agent.route = re;
            agent.routeIndex = 1;
            agent.blockedFor = 0;
            if (agent.status !== 'RITORNO ALLA BASE') agent.status = 'IN TRANSITO';
          }
        });
        
        say(`Flotta avviata / Ricalcolo globale eseguito.`);
      }

      for (const a of agents) {
        if (frozen) break 
        if (!a.active || a.status === 'STANDBY') continue

        if (a.cls !== 'B' && a.status !== 'IN CARICA' && a.speedMs > 0) {
            a.battery -= (0.0005 * a.speedMs * timeScaleRef.current);
            if (a.battery <= 0) a.battery = 0;
        }

        if (a.cls !== 'B' && a.battery < 15 && a.status !== 'RITORNO ALLA BASE' && a.status !== 'IN CARICA') {
            a.status = 'RITORNO ALLA BASE';
            a.goal = { ...a.home };
            const clear = a.size / 2 + 0.15;
            const blockers = agents.filter(o => o !== a).map(o => ({ x: o.x, y: o.y, r: o.size / 2 }));
            const route = planRoute({ x: a.x, y: a.y }, a.goal, clear, blockers, 0.35, getGrammarCost);
            if (route) {
                a.route = route;
                a.routeIndex = 1;
                say(`[!] ${a.id} LOW BATTERY (${Math.round(a.battery)}%) · Ritorno in corso.`);
            }
        }

        if (a.routeIndex >= a.route.length || a.status === 'ARRIVATO') {
            if (a.status === 'RITORNO ALLA BASE') {
                a.status = 'IN CARICA';
                a.heading = -Math.PI / 2;
                say(`${a.id} ancorato alla base. Inizio ricarica.`);
            }
            if (a.status === 'IN CARICA') {
                a.battery += (0.5 * timeScaleRef.current);
                if (a.battery >= 100) {
                    a.battery = 100;
                    a.status = 'ARRIVATO'; 
                    a.idleTimer = 180; 
                    say(`${a.id} ricarica completata. Pronto al deployment.`);
                }
                continue; 
            }

            if (a.idleTimer > 0) {
                a.idleTimer--;
                if (a.model === 'scrubber' && a.status !== 'PULIZIA IN CORSO') {
                    a.status = 'PULIZIA IN CORSO';
                } else if (a.model === 'security' && a.status !== 'PATTUGLIA FISSA') {
                    a.status = 'PATTUGLIA FISSA';
                } else if ((a.model === 'humanoid' || a.model === 'wheelchair' || a.model === 'stroller' || a.model === 'quadruped') && a.status !== 'ASSISTENZA PASSEGGERI') {
                    a.status = 'ASSISTENZA PASSEGGERI';
                } else if ((a.model === 'delivery' || a.model === 'suitcase') && a.status !== 'OPERATIVO SUL POSTO') {
                    a.status = 'OPERATIVO SUL POSTO';
                }
                continue; 
            }

            if (a.cls === 'B') {
                a.active = false;
                say(`Completamento missione passeggero: ${a.id} imbarcato al gate.`);
                continue;
            }

            let newGoal = { x: 0, y: 0 };
            
            const zonesList = [
              { name: 'Baggage Claim', x: -140, y: 225 },
              { name: 'Duty Free Plaza', x: 0, y: 80 },
              { name: 'Food Court Ovest', x: -100, y: 80 },
              { name: 'VIP Lounge Est', x: 80, y: 80 },
              { name: 'Molo Partenze Nord', x: 0, y: -180 },
              { name: 'Check-in Sud', x: 0, y: 150 }
            ];

            const chosenDest = zonesList[Math.floor(Math.random() * zonesList.length)];
            newGoal = { x: chosenDest.x + (Math.random() - 0.5) * 10, y: chosenDest.y + (Math.random() - 0.5) * 10 };

            a.goal = { ...newGoal };
            const clear = a.size / 2 + 0.15;
            const blockers = agents.filter(o => o !== a && o.active).map(o => ({ x: o.x, y: o.y, r: o.size / 2 }));
            const route = planRoute({ x: a.x, y: a.y }, a.goal, clear, blockers, 0.35, getGrammarCost);
            
            if (route) {
                a.route = route;
                a.routeIndex = 1;
                a.status = 'IN TRANSITO';
                
                if (a.model === 'scrubber') {
                    a.idleTimer = 350 + Math.floor(Math.random() * 200); 
                } else if (a.model === 'security') {
                    a.idleTimer = 250; 
                } else if (a.model === 'humanoid' || a.model === 'wheelchair') {
                    a.idleTimer = 150; 
                } else {
                    a.idleTimer = 100; 
                }

                if (a.selected) say(`${a.id} (${a.name}): nuova missione verso ${chosenDest.name}.`);
            } else {
                a.idleTimer = 120;
            }
            continue;
        }

        const target = a.route[a.routeIndex]
        const dx = target.x - a.x
        const dy = target.y - a.y
        const d = Math.hypot(dx, dy)
        let step = unitsPerFrame(a.speedMs, timeScaleRef.current)

        if (grammarOnRef.current) {
          const frontX = a.x + Math.cos(a.heading) * (a.size / 2);
          const frontY = a.y + Math.sin(a.heading) * (a.size / 2);

          const canReadP3 = a.reads.includes('Z1') || a.reads.includes('Z2');
          const onP3 = P3_SIGNS.find(g => frontX >= g.x && frontX <= g.x + g.w && frontY >= g.y && frontY <= g.y + g.h);

          if (!(a as any)._p2Cache || frameCount % 6 === 0) {
            let foundP2 = null;
            let foundDist = Infinity;
            for (let rDist = 0; rDist <= 8; rDist += 1.0) {
              const lx = a.x + Math.cos(a.heading) * rDist;
              const ly = a.y + Math.sin(a.heading) * rDist;
              foundP2 = P2_SIGNS.find(g => lx >= g.x && lx <= g.x + g.w && ly >= g.y && ly <= g.y + g.h);
              if (foundP2) {
                foundDist = rDist;
                break;
              }
            }
            (a as any)._p2Cache = { p2: foundP2, dist: foundDist };
          }
          const upcomingP2 = (a as any)._p2Cache.p2;
          const distToP2 = (a as any)._p2Cache.dist;

          const z0Yield = !canReadP3 && upcomingP2 && distToP2 < (a.size / 2 + 1.2);
          const shouldCheckYield = (canReadP3 && onP3) || z0Yield;

          if (upcomingP2 && shouldCheckYield) {
            const interCX = upcomingP2.x + upcomingP2.w/2;
            const interCY = upcomingP2.y + upcomingP2.h/2;
            
            const isP2Occupied = agents.some(other => {
                if (other === a || !other.active || other.status === 'STANDBY') return false;
                if (other.status === 'CEDE (P.3)' || other.status === 'SCANSIONE (L.2)') return false;
                return dist(other.x, other.y, interCX, interCY) < 1.8;
            });

            const pA = getPriority(a.id);
            const myDistToInter = dist(a.x, a.y, interCX, interCY);

            const higherPriorityIncoming = agents.some(other => {
              if (other === a || !other.active || other.status === 'STANDBY' || other.status === 'IN CARICA') return false; 
              
              const otherDistToInter = dist(other.x, other.y, interCX, interCY);
              if (otherDistToInter > 9) return false; 

              let diffHeading = Math.abs(a.heading - other.heading);
              if (diffHeading > Math.PI) diffHeading = 2 * Math.PI - diffHeading;
              if (diffHeading < Math.PI / 2.5 && otherDistToInter > myDistToInter) {
                  return false; 
              }

              const otherInHub = Math.abs(other.x) <= 19 && Math.abs(other.y) <= 19;
              const aInHub = Math.abs(a.x) <= 19 && Math.abs(a.y) <= 19;

              if (otherInHub && !aInHub) {
                  const angleToInter = Math.atan2(interCY - other.y, interCX - other.x);
                  let diff = Math.abs(other.heading - angleToInter);
                  if (diff > Math.PI) diff = 2 * Math.PI - diff;
                  if (diff < Math.PI / 2.5 || otherDistToInter < 3) return true; 
                  return false;
              }
              if (!otherInHub && aInHub) return false; 

              const frontOX = other.x + Math.cos(other.heading) * (other.size / 2);
              const frontOY = other.y + Math.sin(other.heading) * (other.size / 2);
              const otherOnP3 = P3_SIGNS.some(g => frontOX >= g.x && frontOX <= g.x + g.w && frontOY >= g.y && frontOY <= g.y + g.h);

              if (otherOnP3) {
                  const pOther = getPriority(other.id);
                  if (pOther < pA) return true;
                  if (pOther === pA && other.id < a.id) return true;
              }
              return false;
            });

            if (isP2Occupied || higherPriorityIncoming) {
              step = 0;
              if (a.status !== 'CEDE (P.3)' && a.status !== 'RITORNO ALLA BASE') {
                a.status = 'CEDE (P.3)';
                if (a.selected) say(`${a.id} cede il passo all'incrocio.`);
              }
            } else if (a.status === 'CEDE (P.3)') {
              a.status = 'IN TRANSITO';
            }
          } else if (a.status === 'CEDE (P.3)') {
            a.status = 'IN TRANSITO';
          }

          const canReadL2 = a.reads.includes('Z1') || a.reads.includes('Z2');
          const onL2 = L2_THRESHOLDS.find(g => frontX >= g.x && frontX <= g.x + g.w && frontY >= g.y && frontY <= g.y + g.h);

          if (canReadL2 && onL2 && (a as any).lastL2 !== onL2.id) {
            if ((a as any).l2Timer === undefined) (a as any).l2Timer = 90;

            if ((a as any).l2Timer > 0) {
              step = 0;
              (a as any).l2Timer--;
              if (a.status !== 'SCANSIONE (L.2)' && a.status !== 'RITORNO ALLA BASE') {
                const oldStatus = a.status;
                a.status = 'SCANSIONE (L.2)';
                (a as any).prevStatus = oldStatus;
                if (a.selected) say(`${a.id} scansione ambientale L.2`);
              }
            } else {
              (a as any).lastL2 = onL2.id;
              if (a.status === 'SCANSIONE (L.2)') a.status = (a as any).prevStatus || 'IN TRANSITO';
            }
          }
        }

        // ── FORZA DI SEPARAZIONE LOCALE (Anti-grumo continuo) ──
        let sepX = 0;
        let sepY = 0;
        for (const o of agents) {
          if (o === a || !o.active || o.status === 'STANDBY' || o.status === 'IN CARICA') continue;
          const distBetween = dist(a.x, a.y, o.x, o.y);
          const minDist = a.size / 2 + o.size / 2 + 0.4;
          if (distBetween < minDist && distBetween > 0.001) {
            const force = (minDist - distBetween) / minDist;
            sepX += ((a.x - o.x) / distBetween) * force * 0.45;
            sepY += ((a.y - o.y) / distBetween) * force * 0.45;
          }
        }

        const baseNx = d < step ? target.x : a.x + (dx / d) * step
        const baseNy = d < step ? target.y : a.y + (dy / d) * step

        const nx = baseNx + sepX;
        const ny = baseNy + sepY;

        let hit = false
        let hitAgent: Agent | null = null;
        for (const o of agents) {
          if (o === a || !o.active || o.status === 'STANDBY' || o.status === 'IN CARICA') continue
          const newDist = dist(nx, ny, o.x, o.y);
          const oldDist = dist(a.x, a.y, o.x, o.y);
          if (newDist < a.size / 2 + o.size / 2 + 0.1 && newDist < oldDist) {
            hit = true
            hitAgent = o;
            break
          }
        }

        if (hit) {
          let isQueuing = false;
          if (hitAgent) {
            let diffHeading = Math.abs(a.heading - hitAgent.heading);
            if (diffHeading > Math.PI) diffHeading = 2 * Math.PI - diffHeading;
            
            if (diffHeading < Math.PI / 2) {
                isQueuing = true; 
            }
            if (hitAgent.status === 'CEDE (P.3)' || hitAgent.status === 'SCANSIONE (L.2)') {
                 isQueuing = true;
            }
          }

          if (a.status !== 'CEDE (P.3)' && a.status !== 'IN TRANSITO' && a.status !== 'RITORNO ALLA BASE') {
            a.status = 'CEDE (P.3)'
          }

          if (isQueuing) {
            a.blockedFor = 0; 
          } else {
            a.blockedFor++; 
          }

          const agentGoal = a.goal;
          
          if (a.blockedFor > 40 && a.routeIndex < a.route.length - 1) {
            a.routeIndex++; 
            a.blockedFor = 0;
            continue;
          }

          if (a.blockedFor > 90 && (frameCount + parseInt(a.id.replace(/\D/g, '') || '1')) % 5 === 0 && agentGoal) {
            const clear = a.size / 2 + 0.15;
            
            if (a.blockedFor === 91) {
              const escapeAngle = a.heading + (Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2);
              const escapeX = a.x + Math.cos(escapeAngle) * 1.5;
              const escapeY = a.y + Math.sin(escapeAngle) * 1.5;
              if (isFree(escapeX, escapeY, clear)) {
                a.x = escapeX;
                a.y = escapeY;
              }
            }

            const blockers = agents
              .filter((o) => o !== a && o.active && o.status !== 'STANDBY' && o.status !== 'IN CARICA')
              .map((o) => ({ x: o.x, y: o.y, r: o.size / 2 + 0.05 }))
            
            const re = planRoute({ x: a.x, y: a.y }, agentGoal, clear, blockers, 0.2, getGrammarCost);
            a.blockedFor = 0;
            if (re) {
              a.route = re;
              a.routeIndex = 1;
              if (a.status !== 'RITORNO ALLA BASE') a.status = 'IN TRANSITO';
              if (a.selected) say(`${a.id} manovra di scarto ed evita l'imbottigliamento.`);
            }
          }
          continue 
        }
        
        a.blockedFor = 0
        if (a.status !== 'IN TRANSITO' && a.status !== 'RITORNO ALLA BASE' && a.status !== 'SCANSIONE (L.2)' && a.status !== 'CEDE (P.3)' && step > 0) {
            a.status = 'IN TRANSITO'
        }
        a.heading = Math.atan2(dy, dx)
        a.x = nx
        a.y = ny
        if (d < step) a.routeIndex++
      }

      const sel = agents.find((a) => a.selected);
      if (sel && sel.route.length > 1) {
        let inLane = 0; let tot = 0;
        for (let i = 1; i < sel.route.length; i++) {
          const d = dist(sel.route[i - 1].x, sel.route[i - 1].y, sel.route[i].x, sel.route[i].y);
          tot += d;
          const mx = (sel.route[i - 1].x + sel.route[i].x) / 2;
          const my = (sel.route[i - 1].y + sel.route[i].y) / 2;
          if (COST_SIGNS.some(g => g.type === 'L.1' && mx >= g.x && mx <= g.x + g.w && my >= g.y && my <= g.y + g.h)) {
            inLane += d;
          }
        }
        setLaneUsage(tot > 0 ? Math.round((inLane / tot) * 100) : 0);
      } else {
        setLaneUsage(0);
      }

      if (sel !== lastSelected) {
        lastSelected = sel ?? null
        inspectorTick = 0
      }
      if (inspectorTick-- > 0) return
      inspectorTick = 7

      if (sel) {
        let remaining = 0
        if (sel.active && sel.routeIndex < sel.route.length) {
          remaining += dist(sel.x, sel.y, sel.route[sel.routeIndex].x, sel.route[sel.routeIndex].y)
          for (let i = sel.routeIndex + 1; i < sel.route.length; i++) {
            remaining += dist(sel.route[i - 1].x, sel.route[i - 1].y, sel.route[i].x, sel.route[i].y)
          }
        }
        setInspector({
          id: sel.id,
          name: sel.name,
          cls: sel.cls,
          governable: sel.governable,
          task: sel.task,
          color: sel.color,
          x: Math.round(sel.x),
          y: Math.round(sel.y),
          height: sel.height,
          footprint: sel.footprint,
          weight: sel.weight,
          speed: sel.speed,
          sensors: sel.sensors,
          nav: sel.nav,
          reads: sel.reads,
          deploy: sel.deploy,
          active: sel.active,
          status: sel.status,
          remaining: Math.round(remaining),
          battery: sel.battery,
        })
      } else {
        setInspector(null)
      }
    }

    const drawGrid = () => {
      const halfW = canvas.clientWidth / 2 / cam.zoom
      const halfH = canvas.clientHeight / 2 / cam.zoom
      
      const x0 = cam.x - halfW - 50
      const x1 = cam.x + halfW + 50
      const y0 = cam.y - halfH - 50
      const y1 = cam.y + halfH + 50

      ctx.lineWidth = 1 / cam.zoom
      
      const pass = (step: number, color: string) => {
        if (step * cam.zoom < 6) return
        ctx.strokeStyle = color
        ctx.beginPath()
        for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) {
          ctx.moveTo(x, y0)
          ctx.lineTo(x, y1)
        }
        for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) {
          ctx.moveTo(x0, y)
          ctx.lineTo(x1, y)
        }
        ctx.stroke()
      }

      pass(5, 'rgba(255, 255, 255, 0.025)')   
      pass(25, 'rgba(255, 255, 255, 0.06)')  
    }

    const drawGrammarLayer = () => {
      if (cam.zoom < 1.5 && !grammarOnRef.current) return; 
      
      ctx.save();
      ctx.globalAlpha = grammarOnRef.current ? 1.0 : 0.15; 
      const mod = 0.1; 

      const crossSigns = GRAMMAR.filter(n => n.type === 'P.2' || n.type === 'P.3' || (n.type === 'L.2' && n.style !== 'line'));

      for (const g of GRAMMAR) {
        if (g.type === 'C.1') {
          ctx.fillStyle = `rgba(255, 255, 255, ${g.alpha ?? 0.12})`;
          ctx.fillRect(g.x, g.y, g.w, g.h);
        }
        else if (g.type === 'C.2') {
          ctx.strokeStyle = 'rgba(255, 100, 100, 0.5)';
          ctx.lineWidth = 0.05;
          for(let dx = g.x + 0.2; dx < g.x + g.w; dx += 0.4) {
              for(let dy = g.y + 0.2; dy < g.y + g.h; dy += 0.4) {
                  ctx.beginPath(); ctx.arc(dx, dy, 0.05, 0, Math.PI * 2); ctx.stroke();
              }
          }
          ctx.strokeStyle = 'rgba(255, 100, 100, 0.9)';
          ctx.lineWidth = 0.2;
          ctx.strokeRect(g.x, g.y, g.w, g.h);
        } 
        else if (g.type === 'L.1') {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
          ctx.fillRect(g.x, g.y, g.w, g.h);
          
          const chevW = 0.875;
          const chevH = 1.4;
          const CHEV_STEP = 3;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.lineWidth = 0.15;
          ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';

          const inCrossing = (px: number, py: number) =>
            crossSigns.some(n =>
              px >= n.x - 0.9 && px <= n.x + n.w + 0.9 &&
              py >= n.y - 0.9 && py <= n.y + n.h + 0.9
            );

          const isHubLoop = g.id.startsWith('hub_loop');
          const isHoriz = g.w > g.h;
          const rawStart = isHubLoop ? -20 + LANE_W : (isHoriz ? g.x + 2 : g.y + 2);
          const rawEnd = isHubLoop ? 20 - LANE_W : (isHoriz ? g.x + g.w - 2 : g.y + g.h - 2);
          const span = rawEnd - rawStart;
          const n = Math.max(1, Math.floor(span / CHEV_STEP) + 1);
          const used = (n - 1) * CHEV_STEP;
          const chevStart = rawStart + (span - used) / 2;

          if (isHoriz) {
            const cy = g.y + g.h / 2;
            for (let i = 0; i < n; i++) {
              const x = chevStart + i * CHEV_STEP;
              if (inCrossing(x, cy) && !isHubLoop) continue;
              ctx.beginPath();
              ctx.moveTo(x - (chevH/2)*(g.dir || 1), cy - chevW/2);
              ctx.lineTo(x + (chevH/2)*(g.dir || 1), cy);
              ctx.lineTo(x - (chevH/2)*(g.dir || 1), cy + chevW/2);
              ctx.stroke();
            }
          } else {
            const cx = g.x + g.w / 2;
            for (let i = 0; i < n; i++) {
              const y = chevStart + i * CHEV_STEP;
              if (inCrossing(cx, y) && !isHubLoop) continue;
              ctx.beginPath();
              ctx.moveTo(cx - chevW/2, y - (chevH/2)*(g.dir || 1));
              ctx.lineTo(cx, y + (chevH/2)*(g.dir || 1));
              ctx.lineTo(cx + chevW/2, y - (chevH/2)*(g.dir || 1));
              ctx.stroke();
            }
          }
        }
        else if (g.type === 'P.2') {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.fillRect(g.x, g.y, g.w, g.h);
          const GLYPH_R = 0.6;
          const cx = g.x + g.w / 2; const cy = g.y + g.h / 2;
          ctx.fillStyle = '#000';
          ctx.fillRect(cx - GLYPH_R, cy - GLYPH_R, GLYPH_R * 2, GLYPH_R * 2);
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.moveTo(cx, cy - GLYPH_R); ctx.lineTo(cx + GLYPH_R, cy);
          ctx.lineTo(cx, cy + GLYPH_R); ctx.lineTo(cx - GLYPH_R, cy);
          ctx.fill();
        }
        else if (g.type === 'L.2' && g.style === 'line') {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.lineWidth = 0.08;
          ctx.beginPath();
          if (g.w >= g.h) {
            const cy = g.y + g.h / 2;
            ctx.moveTo(g.x, cy); ctx.lineTo(g.x + g.w, cy);
          } else {
            const cx = g.x + g.w / 2;
            ctx.moveTo(cx, g.y); ctx.lineTo(cx, g.y + g.h);
          }
          ctx.stroke();
        }
        else if (g.type === 'P.3' || (g.type === 'L.2' && g.style !== 'line')) {
          ctx.fillStyle = '#000'; 
          ctx.fillRect(g.x, g.y, g.w, g.h);
          ctx.fillStyle = g.type === 'P.3' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.3)';
          ctx.fillRect(g.x, g.y, g.w, g.h);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.lineWidth = 0.05;
          for (let dx = g.x + 0.2; dx < g.x + g.w; dx += 0.4) {
              for (let dy = g.y + 0.1; dy < g.y + g.h; dy += 0.4) {
                  ctx.beginPath(); ctx.arc(dx, dy, 0.03, 0, Math.PI * 2); ctx.stroke();
              }
          }
        }
        else if (g.type === 'P.1') {
          const tagS = 2 * mod; 
          const cx = g.x + g.w / 2; const cy = g.y + g.h / 2;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.setLineDash([0.1, 0.1]);
          ctx.strokeRect(cx - g.w/2, cy - g.h/2, g.w, g.h); 
          ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.fillRect(cx - tagS/2, cy - tagS/2, tagS, tagS); 
          ctx.fillStyle = '#000';
          const bit = tagS / 4;
          ctx.fillRect(cx - tagS/2 + bit, cy - tagS/2 + bit, bit, bit);
          ctx.fillRect(cx + bit, cy, bit, bit);
        }
      }
      ctx.restore();
    }

   const drawArchitecture = () => {
      const activeHoverId = hoveredZoneRef.current && !cam.isZoomed && !cam.followingAgent ? hoveredZoneRef.current : null;

      // ── 1. MASTERPLAN ESTERNO (APRON, TAXIWAYS, ELIPORTO E AEROMOBILI) ──
      ctx.save();

      // Linea di asse pista / taxiway principale circolare
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = 1.2 / cam.zoom;
      ctx.setLineDash([8 / cam.zoom, 8 / cam.zoom]);
      ctx.beginPath();
      ctx.arc(0, 0, 395, -Math.PI * 0.95, -Math.PI * 0.05);
      ctx.stroke();
      ctx.setLineDash([]);

      // Helipad esterno (Apron Nord-Ovest, posizionato a distanza di sicurezza)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1.5 / cam.zoom;
      ctx.beginPath();
      ctx.arc(-220, -180, 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-220, -180, 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = "bold 12px 'JetBrains Mono', monospace";
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('H', -220, -180);

      // Funzione per disegnare l'aeromobile senza compenetrazioni
      const drawCommercialAirliner = (
        ax: number, 
        ay: number, 
        rot: number, 
        standLabel: string, 
        jetwayFrom?: { x: number; y: number }
      ) => {
        ctx.save();

        // 1. Stand Box & Linee di Terra
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(rot);

        // Box perimetrale di piazzola
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.lineWidth = 1 / cam.zoom;
        ctx.setLineDash([3 / cam.zoom, 3 / cam.zoom]);
        ctx.strokeRect(-28, -32, 56, 68);
        ctx.setLineDash([]);

        // T-bar stop line (posizionata davanti al muso, senza compenetrare la fusoliera)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.beginPath();
        ctx.moveTo(-4, -26); ctx.lineTo(4, -26);
        ctx.moveTo(0, -26); ctx.lineTo(0, -32);
        ctx.stroke();

        // Etichetta del Gate posizionata dietro la coda
        ctx.font = "3.5px 'JetBrains Mono', ui-monospace, monospace";
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(standLabel, 0, 32);
        ctx.restore();

        // 2. Pontile telescopico / Jet Bridge (articolato lateralmente verso la porta 1L)
        if (jetwayFrom) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.fillStyle = '#000';
          ctx.lineWidth = 1.5 / cam.zoom;

          // Porta 1L (anteriore sinistra)
          const doorLocalX = -2.6;
          const doorLocalY = -12;
          const doorX = ax + (Math.cos(rot) * doorLocalX - Math.sin(rot) * doorLocalY);
          const doorY = ay + (Math.sin(rot) * doorLocalX + Math.cos(rot) * doorLocalY);

          // Punto di snodo esterno per evitare che il braccio attraversi il muso
          const elbowLocalX = -12;
          const elbowLocalY = -22;
          const elbowX = ax + (Math.cos(rot) * elbowLocalX - Math.sin(rot) * elbowLocalY);
          const elbowY = ay + (Math.sin(rot) * elbowLocalX + Math.cos(rot) * elbowLocalY);

          ctx.beginPath();
          ctx.moveTo(jetwayFrom.x, jetwayFrom.y);
          ctx.lineTo(elbowX, elbowY);
          ctx.lineTo(doorX, doorY);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(elbowX, elbowY, 1.6 / cam.zoom, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }

        // 3. Sagoma Aeromobile in Layering corretto (Ali -> Coda -> Fusoliera opaca sopra)
        ctx.translate(ax, ay);
        ctx.rotate(rot);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.fillStyle = '#000'; // Sfondo solido per non mostrare le linee sotto
        ctx.lineWidth = 1.5 / cam.zoom;

        // Ali
        ctx.beginPath();
        ctx.moveTo(0, -2);
        ctx.lineTo(19, 4);
        ctx.lineTo(19, 5.8);
        ctx.lineTo(0, 5.8);
        ctx.lineTo(-19, 5.8);
        ctx.lineTo(-19, 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Motori alari
        for (const dir of [-1, 1]) {
          roundRect(ctx, dir * 8.5 - 1.1, 0, 2.2, 4.8, 0.8);
          ctx.fill();
          ctx.stroke();
        }

        // Impennaggi di coda
        ctx.beginPath();
        ctx.moveTo(0, 16);
        ctx.lineTo(7, 20.5);
        ctx.lineTo(7, 22);
        ctx.lineTo(-7, 22);
        ctx.lineTo(-7, 20.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Fusoliera principale (copre le radici alari interne)
        ctx.beginPath();
        ctx.moveTo(0, -23);
        ctx.bezierCurveTo(2.4, -23, 2.4, -13, 2.4, 0);
        ctx.lineTo(2.4, 15);
        ctx.lineTo(0.5, 22.5);
        ctx.lineTo(-0.5, 22.5);
        ctx.lineTo(-2.4, 15);
        ctx.lineTo(-2.4, 0);
        ctx.bezierCurveTo(-2.4, -13, -2.4, -23, 0, -23);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Parabrezza cockpit
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(0, -17.5, 1.8, -Math.PI * 0.8, -Math.PI * 0.2);
        ctx.stroke();

        // 4. Mezzi di terra (GSE) posizionati all'esterno delle ali
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.strokeRect(-1.6, -31, 3.2, 4);
        ctx.strokeRect(6, 8, 2.2, 3);
        ctx.strokeRect(6, 12, 2.2, 6);

        ctx.restore();
      };

      // ── DOCKING AEROMOBILI NOSE-IN CON ZERO SOVRAPPOSIZIONI ──
      // Molo Nord
      drawCommercialAirliner(0, -395, Math.PI, 'GATE N1', { x: 0, y: -350 });
      drawCommercialAirliner(-90, -315, Math.PI / 2, 'GATE N2', { x: -45, y: -315 });
      drawCommercialAirliner(90, -315, -Math.PI / 2, 'GATE N3', { x: 45, y: -315 });

      // Molo Ovest
      drawCommercialAirliner(-395, 0, Math.PI / 2, 'GATE W1', { x: -350, y: 0 });
      drawCommercialAirliner(-315, -90, Math.PI, 'GATE W2', { x: -315, y: -45 });
      drawCommercialAirliner(-315, 90, 0, 'GATE W3', { x: -315, y: 45 });

      // Molo Est
      drawCommercialAirliner(395, 0, -Math.PI / 2, 'GATE E1', { x: 350, y: 0 });
      drawCommercialAirliner(315, -90, Math.PI, 'GATE E2', { x: 315, y: -45 });
      drawCommercialAirliner(315, 90, 0, 'GATE E3', { x: 315, y: 45 });

      // Stand Remoto R1 e Aereo in Rullaggio (distanziati da Gate N2)
      drawCommercialAirliner(-160, -250, Math.PI * 0.75, 'STAND R1');
      drawCommercialAirliner(220, -220, -Math.PI * 0.35, 'TAXIING');

      // ── 2. DETTAGLI LANDSIDE (INGRESSI, DROP-OFF E STRADA ESTERNA A SUD) ──
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1 / cam.zoom;
      ctx.strokeRect(-190, 268, 370, 22);
      ctx.setLineDash([4 / cam.zoom, 4 / cam.zoom]);
      ctx.beginPath();
      ctx.moveTo(-190, 279); ctx.lineTo(180, 279);
      ctx.stroke();
      ctx.setLineDash([]);

      // Porte scorrevoli [ ◄ ► ] agli ingressi
      const drawDoorSymbol = (gx1: number, gx2: number, gy: number) => {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 1.5 / cam.zoom;
        const mid = (gx1 + gx2) / 2;
        ctx.strokeRect(gx1, gy - 1, (gx2 - gx1) / 2 - 1, 2);
        ctx.strokeRect(mid + 1, gy - 1, (gx2 - gx1) / 2 - 1, 2);
        ctx.restore();
      };
      drawDoorSymbol(-50, -30, 260);
      drawDoorSymbol(30, 50, 260);
      drawDoorSymbol(-160, -140, 260);

      ctx.restore();

      // ── 3. DISEGNO ARCHITETTURA DEL TERMINAL (ZONE E DECOR) ──
      for (const z of ZONES) {
        ctx.save()
        const isHovered = z.id === activeHoverId;
        
        if (activeHoverId && !isHovered) {
          ctx.fillStyle = '#050505';
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        } else {
          ctx.fillStyle = isHovered ? 'rgb(35, 35, 35)' : '#000';
          ctx.strokeStyle = '#fff';
        }

        ctx.lineWidth = (isHovered ? 2.5 : 1.5) / cam.zoom;
        ctx.fillRect(z.x, z.y, z.w, z.h);
        ctx.strokeRect(z.x, z.y, z.w, z.h);

        if (isHovered) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
          ctx.lineWidth = 2 / cam.zoom;
          ctx.setLineDash([8 / cam.zoom, 4 / cam.zoom]);
          ctx.strokeRect(z.x, z.y, z.w, z.h);
          ctx.setLineDash([]);
        }
        ctx.restore()
      }

      // Ostacoli solidi e arredi interni
      ctx.save()
      ctx.strokeStyle = 'rgb(100,100,100)'
      ctx.lineWidth = 1.5 / cam.zoom
      for (const d of DECOR) {
        if (d.r > 0) {
          roundRect(ctx, d.x, d.y, d.w, d.h, d.r)
          ctx.stroke()
        } else {
          ctx.strokeRect(d.x, d.y, d.w, d.h)
        }

        // Texture meccanica per i Travelators
        if ((d.w > 40 && d.h < 3) || (d.h > 40 && d.w < 3)) {
          ctx.save();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.lineWidth = 0.8 / cam.zoom;
          if (d.w > d.h) {
            for (let tx = d.x + 2; tx < d.x + d.w; tx += 3) {
              ctx.beginPath(); ctx.moveTo(tx, d.y); ctx.lineTo(tx, d.y + d.h); ctx.stroke();
            }
          } else {
            for (let ty = d.y + 2; ty < d.y + d.h; ty += 3) {
              ctx.beginPath(); ctx.moveTo(d.x, ty); ctx.lineTo(d.x + d.w, ty); ctx.stroke();
            }
          }
          ctx.restore();
        }
      }
      ctx.restore()

      // Apertura varchi
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 6 / cam.zoom
      for (const [x1, y1, x2, y2] of GAPS) {
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
      }

      drawGrammarLayer() 
    }

    const drawRoute = (agent: Agent) => {
      if (agent.route.length < 2) return
      const u = 1 / cam.zoom
      ctx.save()
      ctx.lineCap = 'butt'
      ctx.lineJoin = 'miter'
      ctx.strokeStyle = agent.color

      const i0 = Math.min(agent.routeIndex, agent.route.length - 1)
      ctx.globalAlpha = 0.22
      ctx.lineWidth = u
      ctx.beginPath()
      ctx.moveTo(agent.route[0].x, agent.route[0].y)
      for (let i = 1; i <= i0; i++) ctx.lineTo(agent.route[i].x, agent.route[i].y)
      ctx.stroke()

      ctx.globalAlpha = 0.9
      ctx.lineWidth = 1.25 * u
      ctx.beginPath()
      ctx.moveTo(agent.route[i0].x, agent.route[i0].y)
      for (let i = i0 + 1; i < agent.route.length; i++) {
        ctx.lineTo(agent.route[i].x, agent.route[i].y)
      }
      ctx.stroke()

      const t = 3 * u
      ctx.globalAlpha = 0.75
      ctx.lineWidth = u
      ctx.beginPath()
      for (let i = 1; i < agent.route.length - 1; i++) {
        const n = agent.route[i]
        ctx.moveTo(n.x - t, n.y)
        ctx.lineTo(n.x + t, n.y)
        ctx.moveTo(n.x, n.y - t)
        ctx.lineTo(n.x, n.y + t)
      }
      ctx.stroke()

      const a0 = agent.route[0]
      const b0 = agent.route[agent.route.length - 1]
      const s = 5 * u
      ctx.globalAlpha = 1
      ctx.lineWidth = u
      ctx.beginPath()
      ctx.rect(a0.x - s, a0.y - s, s * 2, s * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.rect(b0.x - s, b0.y - s, s * 2, s * 2)
      ctx.fillStyle = agent.color
      ctx.fill()

      ctx.font = `${9 * u}px 'JetBrains Mono', ui-monospace, monospace`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = agent.color
      ctx.fillText('A', a0.x + s * 1.8, a0.y)
      ctx.fillText('B', b0.x + s * 1.8, b0.y)
      ctx.restore()
    }

    const drawAgentModel = (a: Agent) => {
      if (a.size * cam.zoom < 7) {
        const r = 3.5 / cam.zoom
        ctx.save()
        ctx.globalAlpha = a.active ? 1 : 0.42
        ctx.fillStyle = a.selected ? a.color : '#000'
        ctx.strokeStyle = a.color
        ctx.lineWidth = 1.2 / cam.zoom
        ctx.beginPath()
        ctx.arc(a.x, a.y, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        ctx.restore()
        return
      }

      ctx.save()
      ctx.translate(a.x, a.y)
      ctx.rotate(a.heading)

      if (a.selected) {
        ctx.shadowBlur = 20
        ctx.shadowColor = a.color
        ctx.strokeStyle = a.color
        ctx.lineWidth = 2 / cam.zoom
        const pulse = (Math.sin(frameCount * 0.1) + 1) * 0.5
        ctx.beginPath()
        ctx.arc(0, 0, a.size * (1 + pulse * 0.35), 0, Math.PI * 2)
        ctx.stroke()
      }

      ctx.globalAlpha = a.active ? 1 : 0.42
      const s = a.size
      ctx.fillStyle = '#000'
      ctx.strokeStyle = a.color
      ctx.lineWidth = 3 / cam.zoom

      if (a.model === 'scrubber') {
        roundRect(ctx, -s * 0.7, -s / 2, s * 1.4, s, 6)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = a.color
        ctx.beginPath()
        ctx.moveTo(s * 0.7, 0)
        ctx.arc(s * 0.7, 0, s * 0.45, -Math.PI / 4, Math.PI / 4)
        ctx.closePath()
        ctx.fill()
      } else if (a.model === 'delivery') {
        roundRect(ctx, -s / 2, -s / 2, s, s, 4)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = a.color
        ctx.beginPath()
        ctx.moveTo(s * 0.5, 0)
        ctx.lineTo(s * 0.1, -s * 0.3)
        ctx.lineTo(s * 0.1, s * 0.3)
        ctx.closePath()
        ctx.fill()
      } else if (a.model === 'humanoid') {
        ctx.beginPath()
        ctx.ellipse(0, 0, s * 0.5, s * 0.34, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = a.color
        ctx.beginPath()
        ctx.arc(s * 0.12, 0, s * 0.26, 0, Math.PI * 2)
        ctx.fill()
      } else if (a.model === 'security') {
        ctx.beginPath()
        ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = a.color
        for (let i = 0; i < 4; i++) {
          const ang = -Math.PI / 3 + (i * Math.PI) / 4.5
          ctx.beginPath()
          ctx.arc(Math.cos(ang) * s * 0.34, Math.sin(ang) * s * 0.34, s * 0.08, 0, Math.PI * 2)
          ctx.fill()
        }
      } else if (a.model === 'wheelchair') {
        roundRect(ctx, -s * 0.42, -s * 0.4, s * 0.84, s * 0.8, 4)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = a.color
        ctx.beginPath()
        ctx.arc(-s * 0.05, -s * 0.5, s * 0.2, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(-s * 0.05, s * 0.5, s * 0.2, 0, Math.PI * 2)
        ctx.fill()
      } else if (a.model === 'suitcase') {
        roundRect(ctx, -s * 0.5, -s * 0.4, s, s * 0.8, 3)
        ctx.fill()
        ctx.stroke()
        ctx.strokeStyle = a.color
        ctx.beginPath()
        ctx.moveTo(-s * 0.35, -s * 0.4)
        ctx.lineTo(-s * 0.35, s * 0.4)
        ctx.stroke()
      } else if (a.model === 'stroller') {
        roundRect(ctx, -s * 0.4, -s * 0.45, s * 0.8, s * 0.9, 4)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = a.color
        ctx.beginPath()
        ctx.arc(s * 0.15, 0, s * 0.38, -Math.PI / 2, Math.PI / 2)
        ctx.closePath()
        ctx.fill()
      } else if (a.model === 'quadruped') {
        roundRect(ctx, -s * 0.5, -s * 0.26, s, s * 0.52, 3)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = a.color
        for (const lx of [-s * 0.38, s * 0.38]) {
          for (const ly of [-s * 0.3, s * 0.3]) {
            ctx.beginPath()
            ctx.arc(lx, ly, s * 0.1, 0, Math.PI * 2)
            ctx.fill()
          }
        }
        ctx.beginPath()
        ctx.arc(s * 0.55, 0, s * 0.14, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }

    const drawHud = () => {
      const pad = 14
      const y = canvas.clientHeight - pad
      const target = 120 / cam.zoom
      const pow = Math.pow(10, Math.floor(Math.log10(target)))
      const unit = [1, 2, 5, 10].map((m) => m * pow).find((v) => v >= target) ?? pow * 10
      const px = unit * cam.zoom

      ctx.save()
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(pad, y - 12)
      ctx.lineTo(pad, y - 5)
      ctx.lineTo(pad + px, y - 5)
      ctx.lineTo(pad + px, y - 12)
      ctx.stroke()

      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.font = '10px ui-monospace, monospace'
      ctx.textBaseline = 'alphabetic'
      ctx.textAlign = 'left'
      ctx.fillText(`${unit} m · ${(cam.zoom / getFitZoom()).toFixed(2)}×`, pad, y - 17)
      ctx.fillStyle = perf.cost > 12 ? 'rgba(255,140,110,0.85)' : 'rgba(255,255,255,0.4)'
      ctx.fillText(`${perf.fps.toFixed(0)} fps · disegno ${perf.cost.toFixed(1)} ms`, pad, y - 30)

      ctx.textAlign = 'right'
      ctx.fillStyle = 'rgba(255,255,255,0.32)'
      ctx.fillText('rotella zoom · trascina sposta · doppio click reset', canvas.clientWidth - pad, y - 5)
      if (hovered) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)'
        ctx.fillText(`⏸ simulazione in pausa · ${hovered.id}`, canvas.clientWidth - pad, y - 18)
      }
      ctx.restore()
    }

    const drag = { active: false, moved: false, sx: 0, sy: 0 }
    const MIN_ZOOM_FACTOR = 0.6
    const MAX_ZOOM = 40

    const clampZoom = (z: number) =>
      Math.max(getFitZoom() * MIN_ZOOM_FACTOR, Math.min(MAX_ZOOM, z))

    const fitZoneZoom = (zone: { w: number; h: number }) =>
      clampZoom(Math.min(canvas.clientWidth / (zone.w + 80), canvas.clientHeight / (zone.h + 80)))

    const resetView = () => {
      cam.followingAgent = null
      cam.targetX = mapCenterX
      cam.targetY = mapCenterY
      cam.targetZoom = getFitZoom()
      cam.isZoomed = false
      setActiveRoom(null)
      setFollowedAgentId(null);
      agents.forEach((a) => (a.selected = false));
    }

    const render = () => {
      if (agentToFollowRef.current) {
        const targetId = agentToFollowRef.current;
        agentToFollowRef.current = null;
        const targetAgent = agents.find(a => a.id === targetId);
        if (targetAgent) {
          agents.forEach((a) => (a.selected = false));
          targetAgent.selected = true;
          cam.followingAgent = targetAgent;
          cam.targetZoom = 15;
          cam.isZoomed = false;
          setActiveRoom(null);
          setFollowedAgentId(targetId);
        }
      }

      const t0 = performance.now()
      if (lastFrameAt) {
        const gap = t0 - lastFrameAt
        perf.fps = perf.fps ? perf.fps * 0.9 + (1000 / gap) * 0.1 : 1000 / gap
      }
      lastFrameAt = t0

      frameCount++

      const mw = toWorld(mouse.x, mouse.y)
      hovered = drag.moved ? null : (agents.find((a) => dist(mw.x, mw.y, a.x, a.y) < pickRadius(a)) ?? null)
      
      const hoveredZone = drag.moved ? null : findZoneAt(mw.x, mw.y)
      if (hoveredZone !== hoveredZoneRef.current) {
        hoveredZoneRef.current = hoveredZone
        setActiveRoom(hoveredZone)
      }

      updateAgents(hovered !== null)

      if (cam.followingAgent) {
        cam.targetX = cam.followingAgent.x
        cam.targetY = cam.followingAgent.y
      }
      cam.x = lerp(cam.x, cam.targetX, 0.1)
      cam.y = lerp(cam.y, cam.targetY, 0.1)
      cam.zoom = lerp(cam.zoom, cam.targetZoom, 0.1)

      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight)

      ctx.save()
      ctx.translate(canvas.clientWidth / 2, canvas.clientHeight / 2)
      ctx.scale(cam.zoom, cam.zoom)
      ctx.translate(-cam.x, -cam.y)

      drawGrid()
      drawArchitecture()

      for (const a of agents) if (a.selected) drawRoute(a)
      for (const a of agents) {
        if (a.cls === 'B' && !a.active) continue;
        drawAgentModel(a)
      }

      ctx.restore()

      canvas.style.cursor = drag.moved ? 'grabbing' : (hovered || (hoveredZoneRef.current && !cam.isZoomed)) ? 'pointer' : 'crosshair'

      drawHud()
      perf.cost = perf.cost * 0.9 + (performance.now() - t0) * 0.1
      raf = requestAnimationFrame(render)
    }

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const nx = e.clientX - rect.left
      const ny = e.clientY - rect.top

      if (drag.active) {
        const dx = nx - mouse.x
        const dy = ny - mouse.y
        if (Math.abs(nx - drag.sx) > 4 || Math.abs(ny - drag.sy) > 4) drag.moved = true
        if (drag.moved) {
          cam.followingAgent = null
          cam.isZoomed = true
          cam.targetX -= dx / cam.zoom
          cam.targetY -= dy / cam.zoom
          cam.x -= dx / cam.zoom
          cam.y -= dy / cam.zoom
        }
      }
      mouse.x = nx
      mouse.y = ny
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const before = toWorld(mouse.x, mouse.y)
      const next = clampZoom(cam.targetZoom * Math.exp(-e.deltaY * 0.0012))
      if (next === cam.targetZoom) return
      cam.targetZoom = next
      cam.isZoomed = true

      if (!cam.followingAgent) {
        cam.targetX = before.x - (mouse.x - canvas.clientWidth / 2) / next
        cam.targetY = before.y - (mouse.y - canvas.clientHeight / 2) / next
      }
    }

    const onDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      drag.active = true
      drag.moved = false
      drag.sx = e.clientX - rect.left
      drag.sy = e.clientY - rect.top
      mouse.x = drag.sx
      mouse.y = drag.sy
    }

    const onUp = (e: MouseEvent) => {
      if (!drag.active) return
      drag.active = false
      if (drag.moved) return 

      const rect = canvas.getBoundingClientRect()
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return

      const w = toWorld(mouse.x, mouse.y)
      const clicked = agents.find((a) => dist(w.x, w.y, a.x, a.y) < pickRadius(a))
      
      if (clicked) {
        playClickSound()
        if (cam.followingAgent === clicked) {
          resetView()
        } else {
          agents.forEach((a) => (a.selected = false))
          clicked.selected = true
          cam.followingAgent = clicked
          cam.targetZoom = 15
          cam.isZoomed = false
          setFollowedAgentId(clicked.id);
        }
        return
      }

      if (cam.isZoomed || cam.followingAgent) {
        playClickSound()
        resetView()
        return
      }

      const clickedZoneId = findZoneAt(w.x, w.y)
      if (clickedZoneId) {
        playClickSound()
        const zone = ZONES.find((z) => z.id === clickedZoneId)
        if (zone) {
          cam.followingAgent = null
          cam.targetX = zone.x + zone.w / 2
          cam.targetY = zone.y + zone.h / 2
          cam.targetZoom = fitZoneZoom(zone)
          cam.isZoomed = true
          setActiveRoom(zone.id)
          say(`Selezione stanza: ${zone.id}`)
        }
        return
      }

      playClickSound()
      resetView()
    }

    const onDoubleClick = () => {
      playClickSound()
      resetView()
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === '0' || e.key === 'Escape') {
        playClickSound()
        resetView()
      }
      if (e.key === '+' || e.key === '=') {
        cam.targetZoom = clampZoom(cam.targetZoom * 1.25)
        cam.isZoomed = true
      }
      if (e.key === '-' || e.key === '_') {
        cam.targetZoom = clampZoom(cam.targetZoom / 1.25)
        cam.isZoomed = true
      }
    }

    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mousedown', onDown)
    canvas.addEventListener('dblclick', onDoubleClick)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('mouseup', onUp)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', resize)
    raf = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mousedown', onDown)
      canvas.removeEventListener('dblclick', onDoubleClick)
      canvas.removeEventListener('wheel', onWheel)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', resize)
    }
  }, [bootStage])

return (
    <div className="flex h-screen overflow-hidden bg-black text-white">
      {/* ── BARRA LATERALE A MONTAGGIO PROGRESSIVO ── */}
      <aside className="relative z-10 flex min-w-[380px] w-[380px] flex-col overflow-y-auto bg-black p-6 font-sans">
        
        {/* HEADER: Logo ad animazione di battitura */}
        <header className="mb-4 border-b border-white pb-3 flex items-baseline">
          <h1 className="text-[1.1rem] font-semibold uppercase tracking-wide font-mono font-normal">
            {bootStage === 0 ? logoText : targetLogo}
            {bootStage === 0 && <span className="animate-pulse">_</span>}
          </h1>
        </header>

        {/* DESCRIZIONE SISTEMA IN MONO CAPS REGULAR */}
        <div className={`mb-6 text-[0.65rem] font-mono uppercase tracking-wider text-[var(--gray-color)] leading-relaxed transition-opacity duration-500 ${bootStage >= 1 ? 'opacity-100' : 'opacity-0'}`}>
          {bootStage === 1 ? descText : targetDesc}
          {bootStage === 1 && <span className="animate-pulse">_</span>}
        </div>

        {/* ── 1. PANNELLO CONTROLLO FLOTTA ── */}
        <div className={`transition-all duration-500 ${bootStage >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
          <div className="mb-3 border-b border-dashed border-[var(--gray-color)] pb-1 text-[0.75rem] font-normal uppercase font-mono tracking-wider flex justify-between items-center">
            <span>[Controllo Flotta]</span>
            <button 
              onClick={() => {
                playClickSound()
                setIsFleetPanelOpen(!isFleetPanelOpen)
              }}
              className="text-[0.65rem] font-mono px-1 py-0.5 text-[var(--gray-color)] hover:text-white transition-colors"
            >
              {isFleetPanelOpen ? '▼ CHIUDI' : '▶ LISTA AGENTI'}
            </button>
          </div>

          <div className="border border-[#333] p-3 font-mono text-[0.65rem] leading-[1.5] space-y-3 bg-black/40">
            <button
              onClick={() => {
                playClickSound()
                simStartedRef.current = true;
                ROSTER.filter(r => r.cls === 'A').forEach(r => agentsToStartRef.current.add(r.id));
                forceReplan.current = true;
              }}
              className="w-full border border-[#444] bg-transparent py-2 font-mono text-[0.7rem] uppercase text-[var(--gray-color)] tracking-wider transition-colors hover:border-white hover:text-white"
            >
              Avvia / Ricalcola Flotta
            </button>

            {isFleetPanelOpen && (
              <div className="border-t border-dashed border-[#444] pt-3 space-y-2">
                <div className="text-[var(--gray-color)] font-sans text-[0.6rem] mb-1">
                  Controllo e tracking singoli agenti:
                </div>

                <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1">
                  {ROSTER.map((agentSpec) => (
                    <div 
                      key={agentSpec.id} 
                      className="flex items-center justify-between border border-[#222] p-2 bg-black/60 hover:border-[#555] transition-colors"
                    >
                      <div className="flex flex-col overflow-hidden">
                        <span className="font-bold font-mono" style={{ color: agentSpec.color }}>
                          {agentSpec.id} <span className="text-white font-normal">// {agentSpec.name}</span>
                        </span>
                        <span className="text-[0.55rem] text-[var(--gray-color)] font-sans truncate">
                          {agentSpec.task} (Classe {agentSpec.cls})
                        </span>
                      </div>

                      <div className="flex gap-1 ml-2 shrink-0">
                        <button
                          onClick={() => {
                            playClickSound()
                            agentToFollowRef.current = agentSpec.id;
                            setFollowedAgentId(agentSpec.id);
                          }}
                          className={`px-2 py-1 border text-[0.55rem] uppercase font-mono tracking-wider transition-all ${
                            followedAgentId === agentSpec.id
                              ? 'border-white bg-white text-black font-bold'
                              : 'border-[#444] text-[var(--gray-color)] bg-transparent hover:border-white hover:text-white'
                          }`}
                          title="Segui sulla mappa"
                        >
                          Segui
                        </button>

                        <button
                          onClick={() => {
                            playClickSound()
                            simStartedRef.current = true;
                            agentsToStartRef.current.add(agentSpec.id);
                          }}
                          className="px-2.5 py-1 border border-[#444] text-[0.6rem] uppercase font-mono tracking-wider text-[var(--gray-color)] hover:border-white hover:text-white transition-all"
                        >
                          Avvia
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── 2. PANNELLO SEMANTICA SPAZIALE ── */}
        <div className={`transition-all duration-500 ${bootStage >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
          <div className="mb-3 mt-6 border-b border-dashed border-[var(--gray-color)] pb-1 text-[0.75rem] font-normal uppercase flex justify-between items-center font-mono tracking-wider">
            <span>[Semantica Spaziale]</span>
            <button 
              onClick={() => {
                playClickSound()
                grammarOnRef.current = !grammarOnRef.current;
                setGrammarOn(grammarOnRef.current);
              }}
              className={`px-3 py-0.5 border text-[0.65rem] font-bold transition-all font-mono ${
                grammarOn 
                  ? 'border-white bg-white text-black' 
                  : 'border-[#444] text-[var(--gray-color)] bg-transparent hover:border-white hover:text-white'
              }`}
            >
              {grammarOn ? 'ON' : 'OFF'}
            </button>
          </div>
          <div className="border border-[#333] p-3 font-mono text-[0.65rem] leading-[1.5] text-[#ccc]">
            <div className="mb-2 font-sans">Prova empirica: confronta il comportamento geometrico puro (caos) con il layer relazionale attivato (ordine).</div>
            <div className="flex justify-between mt-2 pt-2 border-t border-[#444]">
              <span className="text-[var(--gray-color)] font-sans">Costmap Aderenza (L.1)</span>
              <span className={grammarOn ? 'text-[#00E0C0] font-bold font-mono' : 'font-mono'}>
                {laneUsage !== null ? `${laneUsage}%` : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* ── 3. PANNELLO STANZA ATTIVA ── */}
        <div className={`transition-all duration-500 ${bootStage >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
          <div className="mb-3 mt-6 border-b border-dashed border-[var(--gray-color)] pb-1 text-[0.75rem] font-normal uppercase font-mono tracking-wider">
            [Stanza Attiva]
          </div>
          <div className="mb-3 rounded border border-[#444] bg-black/40 p-2 font-mono text-[0.7rem] text-white">
            <div className="font-semibold">{activeRoom ?? 'Nessuna zona in focus'}</div>
          </div>
        </div>

        {/* ── 4. PANNELLO SCHEDA PROTAGONISTA ── */}
        <div className={`transition-all duration-500 ${bootStage >= 5 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
          <div className="mb-3 mt-6 border-b border-dashed border-[var(--gray-color)] pb-1 text-[0.75rem] font-normal uppercase font-mono tracking-wider">
            [Scheda Protagonista]
          </div>
          <div className="relative h-auto border border-white p-4 font-mono text-[0.75rem]">
            {inspector ? (
              <>
                <div className="mb-3 border-b border-white pb-2">
                  <div
                    className="text-[0.9rem] font-bold font-mono"
                    style={{ color: inspector.color, textShadow: `0 0 8px ${inspector.color}88` }}
                  >
                    {inspector.id} // {inspector.name}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.6rem] uppercase font-sans">
                    <span
                      className="border px-1 py-[1px] font-mono"
                      style={{ borderColor: inspector.color, color: inspector.color }}
                    >
                      Classe {inspector.cls}
                    </span>
                    <span className="text-[var(--gray-color)]">
                      {inspector.governable ? 'Governabile' : 'Sola lettura'}
                    </span>
                    <span
                      className="ml-auto border px-1 py-[1px] font-mono"
                      style={{
                        borderColor: inspector.active ? inspector.color : '#555',
                        color: inspector.active ? inspector.color : '#777',
                      }}
                    >
                      {inspector.status}
                    </span>
                  </div>
                  <div className="mt-1 text-[0.7rem] text-white font-sans">{inspector.task}</div>
                </div>

                <div className="space-y-1">
                  <SpecRow label="Coord" value={`X: ${inspector.x}  Y: ${inspector.y}`} />
                  {inspector.active && (
                    <SpecRow label="Residuo a B" value={`${inspector.remaining} u.`} />
                  )}
                  <SpecRow label="Altezza" value={inspector.height} />
                  <SpecRow label="Impronta" value={inspector.footprint} />
                  <SpecRow label="Peso" value={inspector.weight} />
                  <SpecRow label="Velocità" value={inspector.speed} />
                </div>

                <div className="mt-3 border-t border-dotted border-[#444] pt-2">
                  <div className="mb-1 text-[var(--gray-color)] font-sans">Sensori:</div>
                  <div className="text-[0.7rem] text-white font-sans">{inspector.sensors}</div>
                </div>
                <div className="mt-2">
                  <div className="mb-1 text-[var(--gray-color)] font-sans">Navigazione:</div>
                  <div className="text-[0.7rem] text-white font-sans">{inspector.nav}</div>
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <span className="text-[var(--gray-color)] font-sans">Legge:</span>
                  <span className="text-right text-[0.7rem] font-mono" style={{ color: inspector.color }}>
                    {inspector.reads}
                  </span>
                </div>
                <div className="mt-2">
                  <div className="mb-1 text-[var(--gray-color)] font-sans">Deploy:</div>
                  <div className="text-[0.7rem] text-white font-sans">{inspector.deploy}</div>
                </div>
                {inspector.battery !== undefined && (
                  <div className="mt-2 pt-2 border-t border-[#444]">
                    <SpecRow 
                      label="Batteria" 
                      value={inspector.cls === 'B' ? 'N.D. (Gestione Utente)' : `${Math.round(inspector.battery)}%`} 
                    />
                    {inspector.cls !== 'B' && (
                      <div className="w-full h-1 bg-[#333] mt-1">
                        <div 
                          className="h-full transition-all duration-300" 
                          style={{ 
                            width: `${inspector.battery}%`, 
                            backgroundColor: inspector.battery < 20 ? '#ff4444' : '#00E0C0' 
                          }} 
                        />
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="mt-[50px] text-center text-[var(--gray-color)] font-sans">
                &gt; Seleziona un protagonista sulla mappa per caricare la sua scheda giocatore.
              </div>
            )}
          </div>
        </div>

        {/* ── 5. PANNELLO SCALA E TEMPO ── */}
        <div className={`transition-all duration-500 ${bootStage >= 6 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
          <div className="mb-3 mt-6 border-b border-dashed border-[var(--gray-color)] pb-1 text-[0.75rem] font-normal uppercase font-mono tracking-wider">
            [Scala e Tempo]
          </div>
          <div className="border border-[#333] p-3 font-mono text-[0.65rem] leading-[1.5]">
            <div className="flex justify-between">
              <span className="text-[var(--gray-color)] font-sans">Scala:</span>
              <span>1 unità = 1 m</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-[var(--gray-color)] font-sans">Pianta:</span>
              <span>700 × 610 m</span>
            </div>
            <div className="mt-2 flex gap-1 border-t border-dotted border-[#444] pt-2">
              {TIME_SCALES.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    playClickSound()
                    setTimeScale(t)
                  }}
                  className={`flex-1 border px-1 py-1 font-mono text-[0.65rem] transition-colors ${
                    timeScale === t
                      ? 'border-white bg-white text-black'
                      : 'border-[#444] text-[var(--gray-color)] hover:border-white hover:text-white'
                  }`}
                >
                  ×{t}
                </button>
              ))}
            </div>
            <div className="mt-2 text-[var(--gray-color)] font-sans">
              Le andature sono quelle di scheda. ×1 è il tempo reale: attraversare il
              terminale richiede qualche minuto, come nella realtà.
            </div>
          </div>
        </div>

        {/* ── 6. PANNELLO MISSIONE ATTIVA ── */}
        <div className={`transition-all duration-500 ${bootStage >= 7 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
          <div className="mb-3 mt-6 border-b border-dashed border-[var(--gray-color)] pb-1 text-[0.75rem] font-normal uppercase font-mono tracking-wider">
            [Missione Attiva]
          </div>
          <div className="border border-[#333] p-3 font-mono text-[0.65rem] leading-[1.5]">
            {MISSIONS.map((m, idx) => (
              <div key={m.id} className={idx > 0 ? "mt-2 border-t border-dotted border-[#444] pt-2" : ""}>
                <div className="flex justify-between">
                  <span className="text-[var(--gray-color)] font-sans">Agente:</span>
                  <span className="font-mono">{m.id}</span>
                </div>
                <div className="mt-1 flex justify-between gap-2">
                  <span className="text-[var(--gray-color)] font-sans">Tratta:</span>
                  <span className="text-right font-sans">{m.label}</span>
                </div>
              </div>
            ))}
            <div className="mt-2 border-t border-dotted border-[#444] pt-2 text-[var(--gray-color)] font-sans">
              Tutti gli altri {ROSTER.length - MISSIONS.length} agenti sono attivi in modalità autonoma.
            </div>
          </div>
        </div>

        {/* ── 7. PANNELLO TELEMETRIA + PULSANTE AUDIO FINALE ── */}
        <div className={`transition-all duration-500 ${bootStage >= 8 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
          <div className="mb-3 mt-6 border-b border-dashed border-[var(--gray-color)] pb-1 text-[0.75rem] font-normal uppercase font-mono tracking-wider">
            [Telemetria]
          </div>
          <div className="space-y-3">
            <div className="border border-[#333] bg-[var(--highlight)] p-3 font-mono text-[0.65rem] leading-[1.4] text-[#ccc]">
              <div className="h-[150px] overflow-y-auto">
                {log.map((line, i) => (
                  <div key={i}>&gt; {line}</div>
                ))}
              </div>
            </div>

            {/* Pulsante Sound appare alla fine della sidebar nel boot progressivo */}
            <button
              onClick={() => {
                playClickSound()
                setIsMuted(!isMuted)
              }}
              className="w-full border border-[#444] py-2 font-mono text-[0.65rem] uppercase text-[var(--gray-color)] hover:border-white hover:text-white transition-colors"
            >
              {isMuted ? 'Audio: OFF' : 'Audio: ON'}
            </button>
          </div>
        </div>

        {/* ── 8. COLOPHON & CREDITI (CONFORME LINEE GUIDA SUPSI - PROGETTO) ── */}
        <div className={`transition-all duration-500 mt-4 border-t border-dashed border-[#444] pt-3 font-mono text-[0.6rem] leading-relaxed text-[var(--gray-color)] space-y-1 ${bootStage >= 8 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
          <div className="text-white font-bold tracking-wider">[GROUND CONTROL]</div>
          <div>Progetto di tesi di Bachelor in Comunicazione visiva</div>
          <div>SUPSI · Dipartimento ambiente costruzioni e design</div>
          <div className="text-white pt-1">
            © 2026 Gennaro Esposito. Tutti i diritti riservati.
          </div>
        </div>

        {/* ── LINEA VERTICALE DI SEPARAZIONE ── */}
        <div 
          className="absolute right-0 top-0 w-[1px] bg-white transition-all duration-300 ease-out"
          style={{ height: `${Math.min(100, (bootStage / 9) * 100)}%` }}
        />

      </aside>

      {/* ── CANVAS PLANIMETRIA ── */}
      <main className={`relative min-h-0 min-w-0 flex-grow bg-black transition-opacity duration-1000 ${bootStage >= 9 ? 'opacity-100' : 'opacity-0'}`}>
        <canvas ref={canvasRef} className="block h-full w-full" />
      </main>
      
    </div>
  )
}
