PROTAGONISTI — schede giocatore

Classe A = interno, governabile (segue coordinazione + grammatica) · Classe B = dell'utente, non governabile (deve solo leggere la grammatica). Tutti leggono Z0 → tutti possono leggere il pavimento.

A.01 · TENNANT T7AMR              [verificato: fonte Tennant]
  classe    A · governabile
  compito   pulizia (ride-on scrubber)
  altezza   145 cm
  impronta  165 × 85 cm
  peso      492 kg
  velocità  ~0,5–1 m/s [?]
  sensori   array 3D ambiente + LiDAR (BrainOS)
  nav       BrainOS · teach-and-repeat
  legge     Z0
  deploy    aeroporti / grandi superfici

A.02 · AVIDBOTS NEO 2
  classe    A · governabile
  compito   pulizia (scrubber autonomo)
  altezza   ~140 cm [?]
  impronta  ~150 × 80 cm [?]
  peso      ≤ 688 kg
  velocità  1,35 m/s
  sensori   14 sensori · LiDAR 360° + camere 3D 270°
  nav       SLAM
  legge     Z0 · Z1
  deploy    aeroporti

A.03 · OTTOBOT 2.0
  classe    A · governabile
  compito   logistica / consegna
  altezza   ~100 cm [?]
  impronta  ~70 × 70 cm [?]
  peso      —
  velocità  1,67 m/s (6 km/h)
  sensori   LiDAR 3D 360° (Ouster) + camere + ultrasuoni + cliff
  nav       SLAM · 4-wheel swerve
  legge     Z0 · Z1
  deploy    aeroporti [?]

A.04 · UNITREE G1
  classe    A · governabile
  compito   manipolazione
  altezza   132 cm
  impronta  ~40 cm (piedi, ripiegabile)
  peso      35 kg
  velocità  2,0 m/s
  sensori   Livox MID-360 LiDAR 3D + Intel RealSense D435 (depth)
  nav       LiDAR SLAM + depth
  legge     Z0 · Z1 · Z2
  deploy    trial [?]

A.05 · UNITREE H1
  classe    A · governabile
  compito   informazione / guida
  altezza   180 cm
  impronta  ~45 cm
  peso      ~47 kg
  velocità  — [?]
  sensori   LiDAR 3D + depth
  nav       LiDAR SLAM + depth
  legge     Z0 · Z1 · Z2
  deploy    trial [?]

A.06 · KNIGHTSCOPE K5
  classe    A · governabile
  compito   sicurezza / pattuglia
  altezza   164 cm
  impronta  113 × 89 cm
  peso      190 kg
  velocità  1,33 m/s (4,8 km/h)
  sensori   4× camere 4K/HD + termica + 6× LiDAR + 13× sonar
  nav       pattuglia autonoma · SLAM
  legge     Z0 · Z1 · Z2
  deploy    spazi pubblici

B.01 · WHILL AUTONOMOUS
  classe    B · non governabile
  compito   mobilità personale (sedia a rotelle)
  altezza   ~90 cm (seduta ~74) [?]
  impronta  ~99 × 55 cm [?]
  peso      —
  velocità  ~1,2 m/s (passo pedonale)
  sensori   LiDAR + camere + sensori 360° · stop automatico
  nav       autonoma / assistita
  legge     Z0 · Z1
  deploy    aeroporti

B.02 · AIRWHEEL SR5
  classe    B · non governabile
  compito   logistica (valigia auto-segue)
  altezza   55 cm
  impronta  38 × 21 cm
  peso      4,5 kg
  velocità  0,56–1,67 m/s (2–6 km/h)
  sensori   UWB + ultrasuoni + IR + camera 160°
  nav       follow-me (UWB) + anti-ostacolo
  legge     Z0  (UWB = insegue il padrone, non legge il pavimento)
  deploy    consumer

B.03 · GLÜXKIND ELLA
  classe    B · non governabile
  compito   mobilità personale (passeggino smart)
  altezza   ~100 cm [?]
  impronta  ~90 × 60 cm [?]
  peso      13,6 kg
  velocità  1,78 m/s (6,4 km/h)
  sensori   sensori 360° + camere perimetrali
  nav       guida assistita / freno automatico
  legge     Z0 · Z1
  deploy    consumer

B.04 · ROBOT-GUIDA QUADRUPEDE
  classe    B · non governabile
  compito   assistenza (cane-guida robotico)
  altezza   ~40 cm
  impronta  ~70 × 30 cm
  peso      ~15 kg
  velocità  — [?]
  sensori   LiDAR 4D + camere
  nav       zampe · segue percorso + anti-ostacolo
  legge     Z0
  deploy    candidato: Unitree Go2 [?]
GRAMMATICA — i 7 segni

Morfologia: LINEA · PUNTO · CAMPO. Canali per lettore: L luminanza (occhio+camera) · R riflettanza NIR (LiDAR) · Ri rilievo (depth+bastone) · F fiduciale (camera NIR). ■=attivo □=non usato.

COD  NOME               CLASSE  DICE                         L R Ri F   FORMA
L.1  corsia/direzione   LINEA   una via · vai di qui         ■ ■ □ (■)  chevron a larghezza costante, ripetuto lungo la corsia
L.2  confine/soglia     LINEA   qui cambia zona · un limite  ■ □ ■ □    banda-soglia continua (striscia scura + domes ADA)
P.1  àncora posizione   PUNTO   coordinata nota (x,y,θ)      □ □ □ ■    tag fiduciale (tag36h11), invisibile all'occhio (NIR)
P.2  nodo/incrocio      PUNTO   qui i percorsi si incontrano ■ ■ □ □    quadrato pieno + rombo bianco inscritto
P.3  attesa/stop        PUNTO   fermati · cedi · attendi     ■ □ ■ □    patch trasversale alla corsia (scura) + domes ADA
C.1  zona (tipo)        CAMPO   area di tipo X               ■ ■ □ □    tono pieno (chiaro→scuro), NON un'icona
C.2  cautela/pericolo   CAMPO   attenzione: rischio          ■ □ ■ □    campo di domes + barra pesante sul lato pericoloso

Sintassi (le 4 regole):

SX-01  Precedenza      a un nodo (P.2) il ramo entrante cede (P.3), il principale continua
SX-02  Ingresso zona   la soglia (L.2) segna l'entrata in una zona (C.1)
SX-03  Priorità rischio il pericolo (C.2) sovrascrive tutto
SX-04  Innesto corsia  le corsie che confluiscono

Costanti del sistema (per il web):

Livelli Z    Z0 radente (pavimento) · Z1 manipolativa (~metà) · Z2 semantica (occhio ~1,55 m)
Default      in campo aperto la MACCHINA CEDE ALL'UOMO; si marca solo strozzature/incroci (mai un tappeto)
Classi       A = coordinabile · B = solo leggibile
Lettura      segno decodificabile ≥ 3,0 m prima · altezza lettore 0,4–1,8 m · v_max 2,0 m/s · scorcio peggiore 7,6° a 3 m
Rilievo      truncated domes ADA: h 5 mm · base 23–36 mm · passo 41–61 mm
Contrasto    ≥ 30 LRV (BS 8300); il pericolo C.2 lo alza
Tono C.1     pubblica #ededed · mista #d2d2d2 · operativa #a8a8a8
Tre campiture nero = segno · tono grigio = zona C.1 · contorno+tratteggio incrociato = architettura
Colore       b/n, inchiostro #111

Nota per il web: nel simulatore avevi invertito (fondo nero + linea bianca = "vista macchina"). È una scelta valida — ma sono i valori sopra (forme, canali, regole, quote) a definire il comportamento; l'inversione è solo resa.