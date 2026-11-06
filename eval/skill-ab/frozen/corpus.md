# AI hardware / datacenter supply-chain dossier

Source material on the companies, technologies, and dependencies across the AI buildout (compute, memory, fabrication, datacenters, power, networking, materials). Each section is one topic; the connections between topics are NOT given — infer them.

## AI demand boom (root thesis)

## The thesis in one paragraph (May 2026)
$660–725B of Big-5 capex in 2026 (~2x 2025) flows through ~73 inter-
connected pieces. **Bottleneck migrated**: 2024=GPUs, 2025=HBM,
2026=power+advanced-packaging. Structural moats: **NVDA CUDA, TSMC
CoWoS, SK Hynix HBM**; emerging chokepoints in **transformers (2-3yr
lead), gas turbines (5-7yr), HALEU (Centrus-only), InP/EML lasers**.

## 📊 Stock-moves perspective — the freshness pass
See **[B12] scoreboard 2025-2026** and **[B11] Dell AI server BOM
decomposition** for the full data. Headline divergences:

**Biggest 1-yr movers (decomposed)**:
- **Unimicron +726%** (Taiwan HDI PCBs, 20-layer AI motherboards)
- **Vicor +700% TTM** (48V→core voltage; NVDA 800V partnership)
- **Sandisk +505-592%** (HBF + enterprise NAND; post-Feb-25 spin)
- **Delta Electronics +540%** (server power supplies, Taiwan)
- **ASPEED +344-500%** (BMC monopoly; AST2700 ramp)
- **Nan Ya PCB +645%** (lagged comp now caught up)
- **AAOI +441%** (optical, Microsoft's preferred 800G)
- **Credo +54% YTD / multi-x prior** (AECs, Marvell-attacking)
- **Dell +221%** (the user's example — but thin 17.8% GAAP GM)
- **Lumentum +166%** (NVDA $2B lockup + OCS backlog)
- **Wiwynn +144%** (Meta+MSFT ODM)
- **Marvell +130%** (custom ASIC + storage controller)
- **Vertiv +115%** (liquid cooling)
- **Coherent +97%** (NVDA $2B lockup + transceivers)
- **HWM +109%, CRS +97%** (turbine specialty alloys)

**Standout laggards (the "what hasn't priced in" answer)**:
- **Infineon +15-25%** — joined NVDA MGX 800V May 29, 2026.
  **Cleanest catch-up trade** per Edgewater (60-70% Blackwell PM share).
- **Ibiden flat / +5%** — ran in 2025 then stalled; ABF substrate
  monopoly intact. Approved ¥500B 3-yr capex Feb 2026.
- **TE Connectivity** lagged Amphenol despite same TAM
- **Semtech (SMTC)** — AEC competitor to Credo, no AI re-rating
- **NTAP** flat then **+33% on May 29** post-Q4 blowout (just printed)
- **PSTG** roundtripped from $98 ATH to $60s on contested Meta/QLC
- **MARA, RIOT** — pure-play Bitcoin miners that didn't pivot
- **HPE** — lagged Dell + SMCI; Juniper integration drag
- **PSEG near 52-wk low** despite 3 NJ nuclear units (vs CEG)
- **DUK +7% YTD** despite 6 nuclear plants
- **MBLY -2.5%** vs Aurora +90% (AV pair divergence)

**Pair divergences (highest signal)**:
- **SNDK +592% vs WDC +208%** (spin captured 3x multiple)
- **DELL +234% vs SMCI -7%** (Dell took SMCI's hyperscaler share)
- **ASPEED +475% vs Ibiden +5%** (BMC monopoly vs ABF substrate)
- **APH +99% vs TE +20-30%** (Amphenol won NVLink spine)
- **Vicor +700% vs Infineon +15-25%** (Vicor inside, IFX outside)
- **CRWV (cooling) vs MARA (BTC pure)** in BTC pivot cohort
- **AUR +90% vs MBLY -2.5%** (AV deployment vs ADAS)
- **LITE +166% vs COHR +97%** (OCS backlog vs transceivers)

## ⚠️ The cynical-lens layer — read these first
- [K1] **Capital circle** — NVDA put **$50-150B into customers** who
  use it to buy NVDA chips. OpenAI $1.4T commits recycle through
  ORCL ($300B), MSFT ($250B), AMD ($90B warrants), AVGO ($350B).
  HSBC: OpenAI **$207B financing gap by 2030**.
- [K2] **Scoreboard** — Stargate ~10% equity-committed. Oklo
  <5% binding. AMD-OpenAI/Meta 12 GW = warrants, zero GPUs shipped.
  OpenAI cut own pledge **$1.4T → $600B**.
- [K3] **SPOFs** — TSMC CoWoS, ASML, SK Hynix HBM (62%, 70% Rubin
  HBM4), Centrus HALEU, Cleveland-Cliffs GOES, Lumentum InP,
  JSR+Shin-Etsu (90% EUV), MP Materials, **Ajinomoto ABF +30%
  price Q3 2026**.
- [A1] **Demand validation gap** — enterprise AI SW ARR only
  **$60-90B vs $660-725B Big-5 capex** (~10-13%).

## Where the margin lives (the moats)
1. **NVDA** — $5T+ mkt cap; 75% DC GM; $1T Blackwell+Rubin orders.
2. **TSMC** — every advanced AI chip; HPC 61% revenue.
3. **SK Hynix** — 72% op margin Q1 26 on HBM.
4. **ASML** — EUV monopoly; €38.8B backlog.
5. **AVGO** — $73B custom-ASIC backlog; $100B AI rev target 2027.

## Where the demand sits
- **Hyperscalers** [P7→X1] — Big-5 $660-725B 2026.
- **AI labs** [P7→X2] — Anthropic now > OpenAI by revenue.
- **Sovereigns** [P7→X3, X5] — UAE Stargate, Saudi HUMAIN, MGX/PIF.
- **Neoclouds** [P4→D4] — CoreWeave, Crusoe, Lambda.
- **Enterprise servers** [P7→X4, B11] — Dell, SMCI, HPE.
- **ODMs (the hidden layer)** [B1] — Foxconn, Quanta, Wiwynn.
- **BTC miner pivots** [B10] — APLD, IREN, WULF, CORZ.

## The pieces (now 15+ areas; 73 nodes total)
**Existing 8**: [P1] Compute · [P2] Memory · [P3] Mfg · [P4] DC ·
[P5] Energy · [P6] Networking · [P7] Demand · [P8] Supply.

**Tier-1 additions**: [R1] Robotics · [V1] AV · [Z1] China stack ·
[A1] Foundation models · [Q1] Quantum/photonics.

**Skeptical lenses**: [K1] Capital circle · [K2] Scoreboard ·
[K3] SPOFs.

**Synthesis (this round)**: [B11] Dell BOM decomp · [B12] Stock
scoreboard.

**BOM sub-nodes (this round)**: [B1] ODMs · [B2] Connectors ·
[B3] Power mgmt · [B4] BMC+substrate · [B5] DPUs · [B6] AECs ·
[B7] Specialty alloys · [B8] Lagged storage · [B9] Lagged utilities ·
[B10] BTC pivots.

## The "show me the signal" watchlist
- **Overbuild #1**: Anthropic took all of xAI Colossus 1 from CRWV.
- **Overbuild #2**: Lambda IPO H1 26 timing.
- **Overbuild #3**: OpenAI revenue vs $1.4T commit.
- **Overbuild #4**: Saudi HUMAIN GB300 shipment pace (18K of 600K Y1).
- **Margin signal**: ORCL FCF inflection (materially negative).
- **Reality signal**: SMR PPAs becoming signed contracts.
- **Rotation signal**: 2025-winners-now-laggards (CEG -14% YTD, MSFT
  -17% on capex sticker shock, quantum trio RGTI/QBTS -10 to -26%).

## Recommended drill-downs (this round's lens)
- **The lagged trinity to investigate**: Infineon (B3) + PSEG (B9) +
  STX vs PSTG (B8) — three clean "haven't priced in" pairs.
- **The decomposition target**: Dell BOM [B11] → who supplies each
  layer + what % they've moved.
- **The hidden Taiwan layer**: ODMs (B1) + ASPEED+Ibiden (B4) +
  Unimicron (B4) + Delta (B3) — most US investors don't track these.
- **The BTC miner divergence (B10)**: APLD/IREN/WULF/CORZ ripped on
  AI hosting; MARA/RIOT didn't pivot.

---

## Compute chips

## The piece in one paragraph (May 2026)
NVDA still dominates training, but cracks are visible: AMD landed
two parallel **6 GW deals (OpenAI + Meta = 12 GW)**, custom ASICs are
~15–20% of hyperscaler workloads on a **44.6% CAGR**, Anthropic
deployed **>1M Google Ironwood TPUs** (first 7-figure custom fleet),
and Intel 18A finally has real third-party customers (Apple low-end
M-series, Terafab for Tesla/SpaceX/xAI). ARMv9 is the CPU substrate
across every hyperscaler's own CPU (Graviton, Cobalt, Axion, Grace,
Vera).

## What's binding
- **TSMC N3 + CoWoS** is the same hard cap for every advanced AI chip
  on this graph — Blackwell, Rubin, MI400, TPU v7, Trainium 3,
  Maia 200, MTIA. NVDA owns >50% of CoWoS allocation through 2026.
- **HBM** at ~45% of NVDA B200 COGS; SK Hynix >60% share, Samsung
  breaking in via AMD MI455X and Google TPU HBM3E.

## Sub-nodes
- [C1] NVDA — GPU dominance ($5T+ market cap; Q1 FY27 $81.6B)
- [C2] AMD — GPU challenger + EPYC (12 GW commits)
- [C3] ARM Holdings — CPU architecture (ARMv9 royalty engine)
- [C4] Custom AI ASICs (TPU / Trainium / Maia / MTIA)
- [C5] Intel — x86 + Gaudi + 18A foundry recovery

## Watch for
- Custom-ASIC % of hyperscaler workloads inflecting past 25–30%.
- Any signal that Blackwell→Rubin transition is choppy.
- AMD MI400 launch reception vs. Rubin.

---

## Memory & storage

## The piece in one paragraph (May 2026)
HBM is the actual binding constraint on AI compute — sometimes more
than GPUs themselves. SK Hynix runs the table (>60% share, **72% op
margin Q1 26**, 90% NVDA-exposed). Micron is the US sovereign play
(HBM4 in HVM **one quarter early**, only US-sovereign HBM). Samsung
is leapfrogging at HBM4 (1c DRAM + 4 nm foundry base die, Google TPU
HBM3E supplier). Sandisk has 6x'd since spinning out and is
co-developing **HBF (High Bandwidth Flash)** with SK Hynix —
potentially **8–16× HBM capacity** for inference.

## What's binding
- HBM contract pricing now drives NVDA gross margin more than wafer
  pricing. HBM/DRAM up high-teens to 20% in 2026.
- HBM4 mass production target Feb 2026.
- Industry-wide pivot to **3–5 yr LTAs** with hyperscalers breaks
  the historical memory cycle.

## Sub-nodes
- [M1] SK Hynix — HBM leader
- [M2] Micron — US HBM + DRAM (sovereign hedge)
- [M3] Samsung Memory — HBM laggard but leapfrogging
- [M4] Sandisk + WDC — enterprise NAND / SSD
- [M5] HBF — emerging NAND-in-HBM-form for inference

## Watch for
- HBM4 production yields at each player (gates supply through 2027).
- HBF first samples 2H 2026 — if real, changes inference economics.
- NAND cycle: WDC HDD fully sold out at 2x Seagate's $/EB.

---

## Semi manufacturing & equipment

## The piece in one paragraph (May 2026)
The bottleneck has shifted from logic transistors to **packaging
connectivity**. TSMC CoWoS capacity went **13K wpm (end-2023) → 75K
(end-2025) → ~130K (end-2026)** — and is still sold out through
2026. HPC reached **61% of TSMC revenue** Q1 26. ASML's China sales
collapsed (46%→19%) but EUV is sold out through 2027 and 2026 guide
got *raised*. KLA took #1 share in advanced wafer-level packaging
with **+70% YoY revenue**. Intel 18A finally lands real third-party
customers (Apple, Terafab); Samsung 2 nm yields recovered to 55–60%.

## What's binding
- CoWoS allocation — every AI chip waits in this queue.
- High-NA EUV adoption pace (Intel first to accept EXE:5200 for HVM).
- Intel 18A yields (~65–75% mid-2026) and customer trust.

## Sub-nodes
- [F1] TSMC — leading-edge foundry (HPC 61% of revenue)
- [F2] ASML — EUV monopoly (€38.8B backlog, 1.2x annual rev)
- [F3] Semi-cap — AMAT, LRCX, KLAC (advanced packaging boom)
- [F4] Foundry alternatives — Samsung + Intel + Rapidus
- [S4] OSAT + advanced packaging (also reachable via Supply)

## Watch for
- TSMC Arizona Fab 21 Ph2 3 nm pulled forward to **2027** (was 2028).
- Intel 18A external revenue ramp.
- EU Chips Act underdelivery — only ~€8B vs €43B headline.

---

## Datacenter physical buildout

## The piece in one paragraph (May 2026)
The constraint stack: **HV switchgear / large transformers running
2–3 year lead times** is now the slowest physical bottleneck.
Eaton DC orders **+240% YoY** ($22.8B backlog), ABB **$2.4B in DC
electrification orders in Q1 alone** (exceeded all of FY25 in one
quarter), Vertiv backlog **>$15B** and FY26 raised to $13.5–14B,
Modine landed a **$4B hyperscaler chiller LSA**. DLR/EQIX delivering
record bookings on **liquid-cooled 200 MW AI inference leases**.

## The Vera Rubin catalyst
H2 2026 Vera Rubin platform pushes racks to **600 kW** with **45°C
warm-water direct-to-chip** cooling — lets DCs drop chillers entirely.
Major design refresh across cooling + power distribution + REITs.

## Sub-nodes
- [D1] DC REITs — DLR, EQIX
- [D2] Cooling — Vertiv + liquid cooling
- [D3] Power distribution + racks — Schneider, Eaton, ABB
- [D4] AI neoclouds — CoreWeave, Crusoe, Lambda (new buyer layer)

## Watch for
- Transformer lead times — bottleneck through ~late 2027 minimum.
- CoreWeave revenue → backlog burn — first overbuild signal showed
  in May 2026 (Anthropic taking Colossus 1).
- Hyperscaler self-build vs. leased mix — currently shifting toward
  more leased / colo as power siting drives pragmatism.

---

## Energy & grid

## The piece in one paragraph (May 2026)
Power, not GPUs, is now the binding constraint on AI deployment.
Microsoft has **$80B in unfulfillable Azure backlog** explicitly
power-gated. PJM capacity prices hit the FERC cap ($329 → $333/MW-day)
with DCs driving 40–63% of the price action. Transformer lead times
are **115–144 weeks standard, up to 4 years** for specialized units.
GE Vernova gas-turbine backlog **83 → 100 GW** with **+10–20% pricing**
on new bids. Nuclear restarts (TMI 2H 2027 for MSFT, Susquehanna for
AWS, Comanche Peak for AWS via Vistra) becoming the marquee deals.
HALEU bottleneck gates SMRs through ~2028.

## The constraint stack
1. **Transformer + switchgear lead times** (2–3 yrs)
2. **Gas turbine lead times** (5–7 yrs)
3. **HALEU fuel supply** (Centrus only Western HALEU)
4. **Grid construction labor** (Quanta, MasTec)
5. **Permitting** (FERC interconnection queues)

## Sub-nodes
- [E1] Nuclear SMRs — Oklo, NuScale, BWXT, X-energy
- [E2] Uranium — Cameco, NXE, Kazatomprom
- [E3] IPPs / merchant power — CEG, VST, TLN
- [E4] Natural gas peakers + LNG
- [E5] Grid + transformers — GEV, Hitachi Energy
- [E6] HALEU + enrichment — Centrus (new)
- [E7] Grid construction labor — Quanta, MasTec (new)

## Watch for
- TMI restart actual commissioning (2H 27).
- Oklo INL Aurora commercial start (late 2027 / early 2028).
- Behind-the-meter rulings at FERC (PJM rejected Talen-Susquehanna
  BTM, forcing restructure to front-of-meter — sets precedent).

---

## Networking & interconnect

## The piece in one paragraph (May 2026)
Ethernet is winning. **Spectrum-X now outsells Quantum InfiniBand on
Blackwell**, and Dell'Oro projects **Ethernet > InfiniBand in AI
back-end by 2027**. Arista FY26 AI fabric target raised to **$3.5B**;
Broadcom AI revenue **$8.4B Q1 (+106%)** with $73B backlog and Hock Tan
re-affirming **>$100B AI revenue by 2027**. Optical interconnect is
the second binding constraint after CoWoS — **800G+ transceivers
24M → 63M units 2025→2026**, with **demand 2x supply** on InP/EML.
NVDA's response: **$4B optics investment split $2B/$2B** in Coherent
and Lumentum (March 2026).

## What's binding
- InP/EML laser supply (Lumentum sole-source 200G/lane EMLs).
- Co-packaged optics adoption pace — Broadcom Davisson TH6-CPO
  in production March 2026; Quantum-X Photonics shipping H2 26.
- AI scale-up fabric (rack-internal): Astera Scorpio X is the
  emerging story.

## Sub-nodes
- [W1] Switching silicon — Broadcom, Marvell
- [W2] Optical interconnect — Coherent, Lumentum
- [W3] Fabric — Arista + NVDA Spectrum-X (UEC vs IB war)
- [W4] Astera Labs (ALAB) — scale-up fabric (new node)

## Watch for
- Cisco's surprising re-emergence (FY26 AI infra guide $5B → $9B).
- HPE-Juniper combined unit traction post-July 25 close.
- UEC v1.1+ specs landing — Ethernet feature parity with IB.

---

## Demand side (hyperscalers + AI labs)

## The piece in one paragraph (May 2026)
**Big 5 capex 2026 guide: $660–725B combined, ~2x 2025's $410B**.
MSFT $190B, GOOGL $180–190B, AMZN $200B, META $115–145B, ORCL $50B
(+136% YoY). **ORCL capex/revenue 76%**; MSFT 38–45%. Oracle's
emergence is the structural surprise — **$300B / 5-yr OpenAI
contract** underwrites Stargate's Abilene 1.2 GW (live) + 7 GW under
construction. **Anthropic passed OpenAI in revenue** ($30–45B
run-rate vs. OpenAI $25B), and **xAI Colossus → 1M GPUs target by
late 2026**. Combined debt issuance >$400B expected in 2026.

## The new demand layers
- **AI neoclouds (D4)** — CoreWeave $100B backlog, Crusoe, Lambda
- **Enterprise servers (X4)** — Dell ISG $60.8B, SMCI $12.7B Q2 90% AI
- **Sovereign AI (X3)** — UAE Stargate, Saudi HUMAIN, India IndiaAI
- **Sovereign LP layer (X5)** — MGX, PIF, Mubadala, SoftBank

## Sub-nodes
- [X1] Hyperscaler capex — MSFT, GOOGL, AMZN, META, ORCL
- [X2] AI labs — OpenAI, Anthropic, xAI, Mistral
- [X3] Sovereign + enterprise AI buildouts
- [X4] Enterprise AI servers — Dell, SMCI, HPE (new)
- [X5] Sovereign wealth LP layer (new)

## Watch for
- The first overbuild signal landed May 2026: **Anthropic took all
  of xAI's Colossus 1 from CoreWeave**. When AI labs trade clusters
  between neoclouds, supply has caught demand.
- ORCL FCF turning materially negative.
- Sovereign deal flow: Saudi HUMAIN 600K GB300, UAE 200 MW online
  end-2026, EU Sovereign AI €200B InvestAI program.

---

## Raw materials & supply chain

## The piece in one paragraph (May 2026)
Concentration is structural. **Japan = 55% of wafers, 90%+ of EUV
photoresist** (JSR + Shin-Etsu cover 90% of EUV-tool resist).
**China = 98% gallium, 80% germanium, 90%+ heavy REE refining**.
**Taiwan = ~90% of <10 nm logic** (projected to drop to 60% by 2032).
US BIS rules rescinded Biden's AI Diffusion Rule (May 2025) and moved
to a **revenue-share regime** — Nvidia/AMD H20/MI308 with **15% USG
revenue share** since Aug 2025; H200/MI325X case-by-case + 25%
tariff + revenue share since Jan 2026. **MATCH Act (April 2026)**
gives Japan/NL 150 days to adopt US-equivalent controls.

## Bottleneck inventory
- Copper demand: **27–33 t/MW DC** → ~350 kt AI demand 2026 with
  **150 kt deficit** (UBS sees 400 kt+).
- Cleveland-Cliffs is the **sole US grain-oriented electrical steel**
  producer (single point of failure for transformers).
- MP Materials: 6,000 t/yr NdPr target end-2026, DoD 15% stake +
  $110/kg floor — first US sovereign rare earth.

## Sub-nodes
- [S1] Wafers + critical metals (Shin-Etsu/SUMCO/GlobalWafers)
- [S2] Specialty gases + chemicals (JSR/TOK/Entegris/Linde)
- [S3] Geopolitics — China + Taiwan (rules + retaliation)
- [S4] OSAT + advanced packaging — ASE, Amkor (new)

## Watch for
- China gallium/germanium suspension **expires Nov 27, 2026**.
- China April 2026 added 40 Japanese cos to controls — escalation.
- Intel 18A entered HVM at Ocotillo — **first US sub-2 nm node**.
- US share of advanced logic projected **<10% → 28% by 2032**.

---

## NVDA — GPU dominance

## Current state (May 2026)

NVIDIA reported Q1 FY27 (quarter ended April 26, 2026) on May 20, 2026 with record revenue of **$81.6B (+85% YoY, +20% QoQ)** and record Data Center revenue of **$75.2B (+92% YoY)**, which now accounts for ~92% of total sales. Within that, DC compute was $60.4B and DC networking $14.8B (+199% YoY — Mellanox/Spectrum-X/NVLink integration is finally compounding hard). Hyperscalers are ~50% of DC revenue with the rest from AI clouds, sovereigns, enterprise. Guidance for Q2 FY27 is **$91B +/- 2%** with 75% non-GAAP gross margin.

Blackwell drives ~70% of DC compute revenue. The GB300/NVL72 ramp is the fastest product ramp in company history; full-stack software work delivered a 2.7x throughput / 60% lower cost-per-token improvement on GB300 in six months. NVIDIA has booked **>50% of TSMC's CoWoS capacity** for 2026 (TSMC at ~120K wpm late 2025) and the line is sold out through mid-2027. Total supply commitments (inventory + purchase obligations + prepaids) sit at **$145B**.

Market cap was **~$5.19T as of May 26, 2026**, #1 semi by cap. At GTC 2026 (March 16), Huang forecast **$1T in cumulative Blackwell + Rubin orders through 2027**, double his Oct 2025 number. The company authorized an additional **$80B buyback** and raised the dividend from $0.01 to $0.25.

## Key catalysts

- **Vera Rubin ramp:** Production shipments start Q3 FY27 (Aug–Oct 2026), broader ramp Q4/Q1. NVL system has 72 Rubin GPUs + 36 Vera CPUs, 1.3M components, claimed 10x perf/W vs GB200. Huang says NVIDIA "will be constrained throughout the entire life of Vera Rubin."
- **Vera CPU as a standalone product:** Huang quoted a **$20B FY27 standalone Vera CPU revenue expectation** (separate from Rubin bundles), with NVIDIA explicitly targeting "world's leading CPU supplier" status. ARMv9-based, claimed 1.5x perf/core, 2x perf/W, 4x rack density vs x86. Opens a quoted $200B TAM.
- **Networking:** $14.8B DC networking quarter (Spectrum-X, InfiniBand, NVLink) up 199% YoY — Mellanox acquisition is now a major standalone growth engine, not just an attach.
- **China re-entry via B30/B30A:** A downgraded Blackwell variant for China is in development; H200 licenses were approved but no revenue recognized yet. CFO Kress flagged the China AI accelerator TAM at ~$50B.
- **CUDA moat:** Still durable in training. Triton + OpenXLA/PJRT in PyTorch 2.x narrow the gap for inference portability to TPU/Trainium/MI350, but production training workloads remain overwhelmingly on CUDA.

## Risks

- **China zero:** Q1 FY27 had **$0 of DC Hopper shipments to China** vs $4.6B a year earlier. Combined H20 impact across Q1+Q2 FY26 was ~$10.5B revenue + a $4.5B Q1 FY26 inventory writedown. China DC compute is now explicitly excluded from forward outlooks.
- **Custom silicon decoupling:** TPU v7 Ironwood, Trainium 3, Maia 200, MTIA v3 all in production; Broadcom Q1 FY26 AI revenue hit $8.4B (+106% YoY) and Anthropic has deployed >1M Ironwood chips. Hyperscaler custom silicon estimated at 15–20% of internal workloads in 2026, but on a 44.6% CAGR — incremental NVIDIA TAM erosion in inference is real.
- **Supply bottlenecks:** CoWoS sold out, HBM allocations fully committed (SK Hynix >60% share, Samsung HBM4 for AMD MI455X), HBM/DRAM contract prices repricing high-teens to 20% in 2026. Rubin complexity ("close to two million components," ~150 Taiwanese suppliers per system) is a real execution risk.
- **Valuation/sentiment:** Stock has fallen post-earnings in 4 of last 5 prints despite beats — the market is pricing perfection.
- **AMD MI400 / Helios racks in H2 2026** with OpenAI (6GW) and Meta (6GW, ~$60B) commitments — first credible multi-GW alternative deployments.

## Cross-cutting

- **TSMC dependency:** Blackwell and Rubin both on N3/N3P; >50% of CoWoS capacity. Single point of failure.
- **HBM dependency:** SK Hynix primary HBM3E/HBM4 supplier (>60% share). HBM4 mass production target Feb 2026; 16-high HBM target Q4 FY27.
- **ARMv9 dependency:** Grace and Vera CPUs are ARM Neoverse — NVIDIA's CPU push is also an ARM royalty tailwind.
- **Power:** Vera Rubin systems are pushing per-rack power and cooling requirements that drive demand for liquid cooling and ultimately upstream gas turbines / nuclear PPAs (cross-edge to the power nodes).
- **$5B Intel equity stake** at $23.28/share (announced late 2025) — NVIDIA has a financial and strategic interest in Intel's 18A success as a second-source / US-based supply hedge.

## Sources

- [NVIDIA Q1 FY27 CFO Commentary (SEC)](https://www.sec.gov/Archives/edgar/data/0001045810/000104581026000051/q1fy27cfocommentary.htm)
- [NVIDIA Q1 FY27 Press Release (SEC)](https://www.sec.gov/Archives/edgar/data/0001045810/000104581026000051/q1fy27pr.htm)
- [Futurum: NVIDIA Q1 FY27 Data Center Diversification, Blackwell Scale, CPU Upside](https://futurumgroup.com/insights/nvidia-q1-fy2027-data-center-diversification-blackwell-scale-cpu-upside/)
- [CNBC: Nvidia earnings takeaways Q1 FY27](https://www.cnbc.com/2026/05/20/nvidia-nvda-earnings-report-q1-2027.html)
- [Computer Weekly: $4.5B H20 export hit](https://www.computerweekly.com/news/366625005/Nvidia-takes-45bn-hit-due-export-restrictions)
- [Manufacturing Dive: Q1 FY26 export controls](https://www.manufacturingdive.com/news/nvidia-q1-2026-earnings-export-controls-china-trump/749261/)
- [TSMC CoWoS capacity through 2027](https://markets.financialcontent.com/wral/article/tokenring-2025-12-26-tsmc-boosts-cowos-capacity-as-nvidia-dominates-advanced-packaging-orders-through-2027)
- [Digitimes: SK Hynix HBM4 Feb 2026 ramp](https://www.digitimes.com/news/a20251226PD215/sk-hynix-nvidia-hbm4-tsmc-production.html)
- [Yahoo/Finance: GTC 2026 Vera Rubin $1T forecast](https://finance.yahoo.com/markets/stocks/articles/nvidia-gtc-2026-unveils-vera-070536912.html)
- [Capital.com: NVIDIA market cap May 2026](https://capital.com/en-int/markets/shares/nvidia-corp-share-price/market-cap)

---

## AMD — GPU challenger + EPYC CPUs

## Current state (May 2026)

AMD has executed the strongest year of its history. Stock hit an all-time high of **$481.41 on May 22, 2026**, up ~118% over 12 months; market cap is in the **~$760B–$840B range** depending on source (vs $5.19T NVDA). Q1 FY26 (calendar Q1 2026) Data Center revenue was a record **$5.8B, +57% YoY**; full-year 2025 DC was $16.64B (+32%). EPS beat at $1.37 vs $1.29 consensus. The company guided ~$9.9B Q1 total revenue (+32% YoY).

**Server CPU share:** Per Mercury Research (April 2026), Intel still holds 64.2% of x86 server shipments but AMD holds **~41.3% of server CPU revenue share** — the "market skimming" pattern where AMD is taking the premium silicon. Some sources put AMD overall server CPU revenue share near 40%. Q1 2026 was the first quarter Intel's server CPU business grew faster than AMD's DC segment since Q2 2021, suggesting the share grab is decelerating but not reversed.

**GPU roadmap execution:**
- **MI350 series** launched mid-2025: 288GB HBM3E, 8 TB/s, ~20 PFLOPS FP4, FP4/FP6 native. Reached parity with Blackwell B200 in dense FP4; pushed NVIDIA to accelerate B300 (Blackwell Ultra) to also hit 288GB.
- **MI400 / MI455X** unveiled at Advancing AI 2025 / CES 2026: 432GB HBM4, 19.6 TB/s, 40 PFLOPS FP4. **Helios rack-scale platform** delivers up to 3 AI exaflops/rack, shipping Q3 2026. MI430X variant for HPC/government with native FP64.
- **ROCm 7.0** reached feature parity with CUDA for the vast majority of PyTorch / JAX workloads by late 2025 — biggest software gap closure to date. Triton backends for MI350 series are mature.

**Mega design wins:**
- **OpenAI 6GW commitment** with first 1GW MI450 in H2 2026; OpenAI got a warrant for up to 160M AMD shares at $0.01 (~10% potential stake).
- **Meta 6GW commitment** (~$60B over multi-year) using MI450 + 6th gen EPYC "Venice" on Helios racks, plus a parallel 160M-share warrant. Combined OpenAI+Meta: **12GW committed**.
- AWS, Google Cloud, Azure, Tencent all running 5th-gen EPYC instances; Oracle 50K-chip plan reported.
- Samsung supplying HBM4 for MI455X (announced March 2026) — a meaningful Samsung win and a diversification away from SK Hynix.

## Key catalysts

- **MI455X / Helios shipments Q3 2026** — first big test of whether AMD can deliver multi-GW deployments at scale, on schedule.
- **6th-gen EPYC "Venice" and "Verano"** alongside Helios; Meta is lead customer.
- **ROCm 7 maturation** plus OpenAI/Meta tuning their stacks on AMD silicon — the strongest credibility story AMD has ever had on software.
- **Inference market share** — AMD's clearest opening; inference is expected to exceed training and is more cost-sensitive (40–65% TCO advantage potential for non-NVDA silicon at scale).

## Risks

- **NVIDIA still ~80–85% of AI accelerator revenue**; AMD ~5–7%. The gap is enormous in dollar terms — NVDA's FY26 DC was $193.7B vs AMD's full-year 2025 DC of $16.6B.
- **Gross margin gap:** AMD ~54% vs NVDA ~70%+. The single biggest re-rating ceiling.
- **Vera Rubin (NVDA H2 2026) likely outclasses MI400** on raw training perf and integrated NVL system scale; AMD's Helios racks will be measured directly against Rubin pods.
- **Hyperscaler custom silicon (TPU/Trainium/MTIA/Maia)** also takes share from AMD's TAM, not just NVIDIA's.
- **Software still a watch point** — analysts note ROCm gaps still produce sub-optimal real-world utilization for some workloads vs CUDA.
- **Forward P/E ~58x** vs sector median ~37x and NVDA ~25x forward — AMD is now the most expensive of the three on forward earnings; execution slip would hurt.
- **Warrant dilution:** OpenAI + Meta warrants total ~320M shares at $0.01. Performance-gated but a meaningful overhang.

## Cross-cutting

- **TSMC N3 dependency** for MI350/400 — shares CoWoS bottleneck with NVDA, Google TPU, AWS Trainium, Microsoft Maia, Meta MTIA. Every advanced AI chip is on TSMC N3 in 2026.
- **Samsung HBM4 win for MI455X** is a notable Samsung breakthrough (SK Hynix dominates NVDA).
- **6th-gen EPYC "Venice/Verano"** is ARMv9-adjacent — still x86 but the ARM threat in DC is structural and applies to AMD too.
- **OpenAI as kingmaker** — committing 6GW each to AMD, NVDA Blackwell/Rubin, and Broadcom (10GW custom inference ASIC). OpenAI's compute strategy is now a meaningful node on the map.

## Sources

- [AMD Q1 FY26 8-K (SEC)](https://www.sec.gov/Archives/edgar/data/0000002488/000000248826000072/q12026991.htm)
- [AMD Q4 FY25 8-K (SEC)](https://www.sec.gov/Archives/edgar/data/0000002488/000000248826000014/q42025991.htm)
- [Network World: AMD ambitious data center plan + 6GW OpenAI/Meta deals](https://www.networkworld.com/article/4089519/amd-outlines-ambitious-plan-for-ai-driven-data-centers.html)
- [TECHi: AMD-Meta $60B deal](https://www.techi.com/amd-meta-60b-deal-nvidia-ai-monopoly/)
- [SWOTpal: AMD Q1 2026 preview, MI400 HBM4](https://swotpal.com/blog/amd-swot-analysis-2026)
- [Wccftech: MI350 mid-2025, MI400 2026](https://wccftech.com/amd-details-plans-for-instinct-ai-gpu-lineup-mi350-to-now-release-by-mid-2025-mi400-lineup-slated-for-2026/)
- [FinancialContent: Great GPU War of 2026 — MI350 vs Blackwell](https://markets.financialcontent.com/stocks/article/tokenring-2026-1-30-the-great-gpu-war-of-2026-amds-mi350-series-challenges-nvidias-blackwell-hegemony)
- [HeyGoTrade: AMD +114% gain analysis](https://www.heygotrade.com/en/blog/amd-stock-analysis-2026-how-amd-quietly-outperformed-nvidia-with-114-gain/)
- [StockAnalysis: AMD market cap](https://stockanalysis.com/stocks/amd/market-cap/)

---

## ARM Holdings — CPU architecture

## Current state (May 2026)

ARM reported FY26 (year ended March 31, 2026) on May 6, 2026 — its **third consecutive 20%+ revenue growth year as a public company**.

- **Full-year FY26 revenue: $4.92B, +23% YoY** (record)
- Royalty revenue **$2.613B, +21%**; licensing **$2.307B, +25%**
- Non-GAAP diluted EPS: $1.77 (vs $1.63 prior year)
- **Q4 FY26: $1.49B revenue, +20% YoY**; licensing $819M (+29%), royalty $671M (+11%). Non-GAAP EPS $0.60.
- Q3 FY26: $1.242B (+26% YoY), royalty $737M (+27%), license $505M (+25%)
- **Q4 included $200M licensing from a SoftBank-related agreement** — a one-off boost.
- Q4 FY26 guidance for Q1 FY27 implied royalties low-teens YoY and licensing high-teens YoY.
- GAAP operating margin compressed to 18.3% full year (29.4% Q4); non-GAAP 43.0% / 49.1% — opex grew ~30%+ as ARM builds out its own chip-design capability.

**Stock:** ARM is **up ~84% YTD in 2026**, with shares having surged ~97% over the prior three months heading into the May 6 print. Post-earnings was volatile (rose then fell ~6%). Jefferies raised PT to $290 (from $210), RBC to $260 (from $175). Notably, **TSMC fully exited its ARM stake** in late April 2026 (1.11M shares at $207.65, ~$231M), severing a small but symbolic tie.

**v9 royalty mix:** ARM hasn't given a fresh breakdown, but as of Q4 FY25 (the last disclosure), v9 was 31% of royalty revenue (just over v7 and older); v8 was still 44%. Royalty rate per chip continues to rise as v9 adoption deepens, particularly in premium smartphones and data centers. The royalty rate for v9 + Compute Subsystems (CSS) escalates contractually each device cycle.

**Data center share:** ARM's stated target is **~50% of hyperscaler data center CPU sales by end of 2025**, up from ~15% in 2024 — and most coverage suggests it has gotten close.
- **AWS Graviton:** ~50% of AWS new CPU deployments are Graviton; Graviton 5 ships with 192 cores (+25% perf, –33% latency vs Graviton 4). AWS custom silicon (Graviton + Trainium + Nitro) is a >$20B/yr run-rate business with triple-digit growth.
- **Microsoft Cobalt 200**: Neoverse CSS V3 (v9), 132 cores. Deployed across substantial Azure regions; production workloads for Databricks, Siemens, Snowflake.
- **Google Axion (N4A)**: Neoverse N3-based, GA in January 2026, up to 96 vCPUs.
- **NVIDIA Grace** (Neoverse V2, 144 cores) in GB200/GB300; **Vera** announced with 88 ARM cores at GTC 2026 — Huang quoted **$20B standalone Vera revenue target FY27** with 1.5x perf/core and 2x perf/W vs x86.
- **Ampere** continues but is increasingly dwarfed by hyperscaler in-house silicon.
- **Neoverse cores deployed: >1 billion cumulative** — ARM's own milestone.

**Robotics/edge:** NVIDIA Jetson Thor, Qualcomm Dragonwing, Tesla Optimus, Rivian first-production v9 custom autonomy SoC — ARM is becoming the default for physical AI / agentic edge.

**ARM AGI CPU:** Launched in March 2026; the customer pipeline is described as having **created >$2B of customer demand across FY27–FY28**, with management targeting $15B for the AGI CPU line. Data center described as positioned to become ARM's largest segment.

## Key catalysts

- **ARM AGI CPU ramp** + the move from pure IP licensor toward chiplet/CSS/silicon design — more direct revenue capture per design.
- **Vera CPU production (H2 FY27)** — NVIDIA scaling ARM CPU into hyperscale racks at GB/TB scale.
- **v9 mix expansion** in premium smartphones and DC — each cycle lifts blended royalty rate.
- **Rene Haas expanded role at SoftBank International** — strategic signaling that ARM is central to SoftBank's AI agenda (also a management bandwidth question).
- **Robotics/edge AI** as a new royalty leg.

## Risks

- **Qualcomm litigation** still open as a topic in coverage, though not the focus of recent earnings commentary — partner framing dominates now (Dragonwing, automotive). Material verdict risk remains.
- **Smartphone unit softness** from memory supply constraints — partly offset by premium mix shift.
- **Margin compression** as ARM invests in its own chip design — non-GAAP opex +33% full year.
- **Hyperscaler in-house silicon** captures "ARM" cores but does NOT capture the same royalty as a full IP license (CSS helps but not fully).
- **Supply chain skepticism** post Q4 — analysts (Cerity, others) questioning ARM's ability to meet ramping demand timely.
- **Valuation:** Up 84% YTD; pricing in continued execution.

## Cross-cutting

- **NVIDIA Vera is an ARM v9 design** — direct positive feedback loop between NVIDIA growth and ARM royalty.
- **Every hyperscaler custom CPU is ARM** — Graviton (AWS), Cobalt (MSFT), Axion (GOOG), Grace/Vera (NVDA), Ampere (Oracle). x86 share loss in cloud is structural.
- **TSMC fully exited ARM equity stake** April 2026 — symbolic; their partnership for fabbing is unchanged.
- **SoftBank related-party revenue** ($200M in Q4) is a recurring quality-of-earnings flag.

## Sources

- [ARM Q4 FY26 Newsroom](https://newsroom.arm.com/news/arm-q4-fye26-results)
- [ARM Q4 FY26 Results (BusinessWire)](https://www.businesswire.com/news/home/20260506216985/en/Arm-Holdings-plc-Reports-Results-for-the-Fourth-Quarter-and-Fiscal-Year-Ended-2026)
- [ARM 6-K FY26 Q3 (SEC)](https://www.sec.gov/Archives/edgar/data/0001973239/000197323926000005/exhibit992fye26q331-decx25.htm)
- [ARM 6-K FY26 Q4 (SEC)](https://www.sec.gov/Archives/edgar/data/0001973239/000197323926000062/exhibit992fye26q431-marx26.htm)
- [Futurum: ARM Q3 FY26 AI-Driven Royalty Momentum](https://futurumgroup.com/insights/arm-q3-fy-2026-earnings-highlight-ai-driven-royalty-momentum/)
- [SemiWiki: ARM 50% DC CPU share target](https://semiwiki.com/forum/threads/exclusive-arm-expects-its-share-of-data-center-cpu-market-sales-to-rocket-to-50-this-year.22441/)
- [Constellation: ARM data center takeover](https://www.constellationr.com/insights/news/arms-data-center-takeover-lumpy-revolution)
- [Tom's Hardware: ARM 50% DC CPU 2025](https://www.tomshardware.com/pc-components/cpus/arm-aims-to-capture-50-percent-of-data-center-cpu-market-in-2025)
- [TIKR: ARM +84% YTD 2026](https://www.tikr.com/blog/arm-stock-is-up-84-in-2026-heres-whats-driving-the-ai-chip-rally-into-earnings)
- [Capital.com: ARM Q4 FY26 forecast](https://capital.com/en-int/market-updates/arm-holdings-stock-forecast-04-05-2026)

---

## Custom AI ASICs (TPU, Trainium, MTIA, Maia)

## Current state (May 2026)

Analysts are calling 2026 the **"Great Decoupling"** — the first year hyperscaler custom silicon graduates from experiment to load-bearing production. Combined hyperscaler capex is **$660–690B in 2026**, with ~75% directed at AI infrastructure. Custom ASIC adoption is still only **~15–20% of hyperscaler internal workloads**, but on a **44.6% CAGR**. NVIDIA's share of DC AI accelerator revenue dropped from ~92% (2023) to **~80–85% (2026)**, with the rest split among AMD (~5–7%), Google TPU, AWS Trainium, MSFT Maia, Meta MTIA, and others.

### Google TPU v7 "Ironwood"
- Announced Cloud Next April 2025; entered preview November 2025; production 2026.
- **4,614 FP8 TFLOPS per chip; 192GB HBM3E @ 7.37 TB/s; ~500W.**
- TSMC **N3P**, dual-chiplet, co-designed with **Broadcom** and MediaTek; 2x 256x256 MXU arrays + 4 SparseCores.
- Pods of **9,216 chips** with proprietary optical mesh fabric.
- **Anthropic deploys >1 million Ironwood chips** for Claude inference — first 7-figure single-customer deployment of any custom ASIC, ever.
- Broadcom confirmed Google TPU design partner through 2031; Google spends ~$8B/yr with Broadcom on TPU silicon dev.
- External TPU customers: Anthropic, Midjourney, Salesforce, Safe Superintelligence (Sutskever).
- ~2x perf/W vs B200 on inference per industry conference commentary.

### AWS Trainium 3
- Launched December 2025 — AWS's first 3nm AI chip.
- **2.52 PFLOPS FP8 per chip; 144GB HBM3E; ~600W; ~2x training perf vs Trn2.**
- Production ramp Q2 2026; **GPU-based systems still ~60% of AWS's 2026 AI server builds**, but Trainium share climbing.
- AWS custom silicon (Graviton + Trainium + Nitro) is a **>$20B annual run-rate business growing triple digits**.
- **Marvell** is the co-design partner (positioning as Broadcom's most credible competitor).
- Convergence of training and inference SKUs starting with Trn3.

### Microsoft Maia 200
- Deployed January 2026; TSMC **3nm; 140B+ transistors**.
- **10+ PFLOPS FP4; 5 PFLOPS FP8; 216GB HBM3E @ 7 TB/s; 750W envelope.**
- MSFT claims **30% better perf/$** vs best alternative in its fleet; "most performant first-party silicon from any hyperscaler."
- **Serving GPT-5.2 for OpenAI** + M365 Copilot from Des Moines DC.
- Was delayed ~6 months due to OpenAI-requested design changes + sim instability + team turnover. Original Maia 100 (TSMC 5nm) reportedly never ran production AI at scale.
- Marvell is the co-design partner.

### Meta MTIA
- MTIA v3 / v4 targets inference for Llama serving 3B+ users across apps.
- TSMC node progression: MTIA 100 (7nm) → 200 (5nm) → 300-series moving to **3nm with CoWoS**.
- **April 15, 2026: Meta + Broadcom extended partnership through 2029** for custom MTIA chips.
- **Meta committed to 1GW of MTIA deployments initially, scaling to multi-GW through 2029**.
- Meta still buys H100/B200 for training — split between training (NVDA) and inference (custom) defines 2026 economics.
- Meta 2026 capex guide: **$115–135B** — buying from everyone.

### Broadcom + Marvell custom silicon revenue
- **Broadcom Q1 FY26 AI revenue $8.4B (+106% YoY)**; Q2 FY26 guide **$10.7B**; **$73B AI backlog**; targeting **$100B annual AI chip revenue by 2027**.
- **Marvell projects up to $11B in AI ASIC revenue for 2026**.
- Together Broadcom + Marvell control **~95% of the custom AI ASIC co-design market** (BCM ~60%, MRVL ~35%).
- **OpenAI x Broadcom: 10GW deployed custom inference ASIC by 2029**, ~$10B total investment — a major new customer for Broadcom.

### Performance gap
- TPU v7 / Trainium 3 / Maia 200 closer to NVDA Blackwell on inference perf/W, still behind on training.
- Software gap is the bigger constraint, but closing: **Triton has mature backends for TPU, Trainium, MI350**; **PyTorch 2.x + OpenXLA/PJRT** make portability practical.
- Net economics: custom silicon offers **40–65% TCO advantage at scale** for the workload it targets; that's the structural pull.

## Key catalysts

- **Anthropic >1M Ironwood deployment** — first proof point that a single hyperscaler customer can stand up an NVDA-scale fleet on custom silicon.
- **OpenAI–Broadcom 10GW custom ASIC** — most ambitious bespoke silicon project ever announced.
- **Meta–Broadcom 2029 extension** — locks in MTIA roadmap visibility.
- **Maia 200 serving GPT-5.2** — MSFT's first production OpenAI workload on first-party silicon.
- **Software stack convergence** (Triton + OpenXLA + PJRT) reducing CUDA lock-in.

## Risks

- **Custom silicon still ~15–20% of hyperscaler workloads** — easy to overstate decoupling.
- **NVDA roadmap pace (Rubin → Rubin Ultra → Feynman)** keeps moving the goalposts.
- **Every custom chip is on TSMC N3 / CoWoS** — same bottleneck as NVDA; not a supply diversification.
- **HBM allocation** — SK Hynix and Samsung must coordinate with TSMC CoWoS for every design; custom chip ramp competes for the same HBM tonnage as NVDA.
- **Internal use cases only** — none of these (except TPU via GCP) sell to external customers; market sizing is more about TAM erosion than competitive revenue.
- **Execution slippage** is normal (Maia 200 slipped 6 months).

## Cross-cutting

- **TSMC N3/N3P** and **CoWoS** are the single binding constraint across all of TPU v7, Trainium 3, Maia 200, MTIA, MI400, Blackwell, Rubin. Every advanced AI chip in 2026 fabs at one foundry on one packaging line.
- **Broadcom is the most important non-NVDA AI silicon company** — should be its own node on the map if not already.
- **Marvell** is the second meaningful merchant ASIC co-designer; smaller but high-growth ($11B 2026 target).
- **OpenAI** is now committing to NVDA + AMD + Broadcom-custom + MSFT Maia simultaneously — its compute strategy is a major demand-side driver across the entire map.
- **HBM cross-edge:** Custom silicon and NVDA fight for the same SK Hynix / Samsung / Micron HBM4 supply.

## Sources

- [Tom's Hardware: custom AI ASIC state of play May 2026](https://www.tomshardware.com/tech-industry/semiconductors/custom-ai-asics-examined-from-broadcom-to-mtia)
- [Introl: Custom Silicon Inflection 2026](https://introl.com/blog/custom-silicon-inflection-2026-hyperscaler-asics-nvidia-gpu)
- [FinancialContent: Great Decoupling — hyperscaler custom silicon vs NVDA](https://markets.financialcontent.com/wral/article/tokenring-2026-1-1-the-great-decoupling-how-hyperscaler-custom-silicon-is-ending-nvidias-ai-monopoly)
- [Hashrate Index: Inside the Custom AI Chip Race](https://hashrateindex.com/blog/hyperscaler-ai-asic-market-report-part-1/)
- [Broadcom Q1 FY26 8-K (SEC)](https://www.sec.gov/Archives/edgar/data/0001730168/000173016826000011/avgo-02012026x8kxex99.htm)
- [Oplexa: Meta-Broadcom AI chip deal 2026 1GW MTIA 2nm](https://oplexa.com/meta-broadcom-ai-chip-deal-2026/)
- [IntuitionLabs: Google TPU architecture for Gemini 3](https://intuitionlabs.ai/articles/google-tpu-architecture-gemini-3)
- [Silicon Analysts: AI data center value chain 2026](https://siliconanalysts.com/research/ai-data-center-value-chain)
- [Presenc AI: AI chip market share 2026](https://presenc.ai/research/ai-chip-market-share-2026)

---

## Intel — x86 CPUs + Gaudi + foundry

## Current state (May 2026)

Intel under CEO **Lip-Bu Tan** (took over early 2025) is in the midst of a credible — but still fragile — turnaround. Stock has **roughly doubled over the past 12 months**, with INTC trading in the high $30s as of recent prints and **market cap ~$188B**. Q1 2026 (quarter ended March 28) revenue was **$13.6B (+7% YoY)** with EPS $0.29 (vs. $0.01 consensus — a $0.28 beat). Stock gained ~24% in a day on the print — biggest one-day move since 1987. It was the **6th consecutive quarter of revenue beats**.

**DCAI segment:** Data Center & AI revenue was **$5.05B in Q1 2026, +22% YoY**, with AI-specific revenue inside DCAI **>$750M (vs ~$400M a year earlier)**. Notably: **Q1 2026 was the first quarter Intel's server CPU business grew faster than AMD's DC segment since Q2 2021** (Bernstein), suggesting AMD's share-grab has finally decelerated.

### 18A node — yield turnaround is the story
- 18A introduces **gate-all-around RibbonFET + backside power (PowerVia)** — first node in the world combining both.
- **Early-2025 yields were ~10% (up from 5% late 2024)**; **mid-2026 yields ~65–75%** per supply chain reports — "commercially robust."
- Tan reportedly considered abandoning 18A for external foundry use and focusing on 14A; the yield improvement reversed that decision. CFO Zinsner: "good improvements made, steady yield progression … probably a bit ahead of schedule."
- **First 18A products are shipping:** **Panther Lake** (Core Ultra Series 3, AI PC consumer) and **Clearwater Forest (Xeon 6+)** both began shipping from Fab 52 Chandler AZ in late January 2026. Tan called these "the fastest new product ramps in five years."
- Clearwater Forest 288-core Xeon 6990E+ Darkmont E-core: 38% rack power reduction, 60%+ better perf/W vs Sierra Forest. Reportedly **sold out for the remainder of 2026**.

### External foundry wins (the real news)
- **Terafab (Tesla / SpaceX / xAI) — announced April 7, 2026.** Intel will be foundry partner for Musk's ~$25B project targeting 1 terawatt/yr of AI compute. **18A** for initial production; **14A** announced for the future scale-up (Musk publicly called Intel 14A "State-of-the-Art"). Biggest external customer win since the foundry pivot began.
- **Apple** signed a multi-year foundry deal — confirmed in Q1 earnings context.
- **NVIDIA $5B equity investment** at **$23.28/share** (announced late 2025), implying ~4–5% stake — partly framed as collaboration on custom silicon, partly as US-supply hedge.
- **18A-P** getting external inbound interest per Zinsner.
- Tan publicly calls Intel Foundry "a national treasure" given 90% of advanced logic is made outside US.

### Gaudi
- **Gaudi 3 is NOT discontinued** (despite my pre-existing assumption). It's still positioned as an inference-optimized low-price NVDA alternative; in production at select AWS and IBM Cloud clusters.
- **Gaudi 4** planned for **2027 on Intel 18A** — if it lands, could give hyperscalers a viable third option behind NVDA / AMD.
- That said, traction is modest — Gaudi 3 is footnote-sized vs MI300X/Blackwell in the merchant accelerator market.

### Server CPU share
- Q1 2026 Mercury Research: **Intel 64.2% x86 server unit share (+80bps QoQ)**; AMD ~35.8% units, ~41.3% revenue share. Pricing/bundling has stabilized the unit share but not the premium revenue share.
- ARM-based server CPUs (Graviton, Cobalt, Axion, Grace/Vera) are the bigger structural threat than AMD: **ARM ~50% of hyperscaler DC CPU spend by end of 2025** (ARM's target).

### CHIPS Act
- Intel received **>$7.8B direct CHIPS Act funding** + significant tax credits.
- Structure includes an **escrow share arrangement with the U.S. Department of Commerce** — shares released as Intel hits performance milestones; unmet portions get released to DOC for no consideration or cancelled.
- US administration backing remains strong; Tan cites Trump as a major supporter of US foundry buildout.

## Key catalysts

- **Terafab Phase-1 (18A) capacity ramp** through 2026/2027.
- **18A-P external customer announcements** (Zinsner says "inbound interest" — names likely in coming quarters).
- **Continued 18A yield progression toward HVM-typical numbers** (80%+).
- **14A path** — Apple and Tesla are anchor customers; risk-production timing is the big 2027 catalyst.
- **Gaudi 4 on 18A in 2027** — a real hyperscaler design win would re-rate the accelerator story.
- **Server CPU stabilization vs AMD** continues, ideally for multiple quarters.

## Risks

- **Execution risk on 18A scaling** — going from 65–75% yields to mature ~85%+ is non-trivial; any stumble re-opens the AMD share-grab.
- **AMD MI400 / EPYC Venice ramp Q3 2026** with Meta as lead customer — pressure on both DCAI sub-segments simultaneously.
- **ARM in cloud** is structural and not addressable by Intel's roadmap.
- **NVDA + custom silicon** continue to grow the AI accelerator TAM around Intel.
- **Gross margin** still well below historical norms; large GAAP/non-GAAP gap reflects ongoing restructuring charges.
- **Foundry profitability** — winning logos is easier than making the foundry segment cash-flow positive.
- **CHIPS Act escrow mechanism** — if Intel misses milestones, DOC gets the shares and Intel loses cash + dilutes.
- **Tan's restructuring** has involved thousands of layoffs — execution depends on retaining the engineers who can deliver 18A and 14A.

## Cross-cutting

- **NVIDIA $5B Intel equity** + Vera/Rubin discussion about custom Intel-fabbed silicon hedges = NVDA has skin in Intel's 18A success.
- **Terafab links Intel to Musk's xAI compute buildout** — a power/cooling/compute node already on this map likely connects to Intel via 18A.
- **Apple multi-year foundry deal** — first big Apple silicon production at Intel; competes with TSMC for the most prestigious customer.
- **CHIPS Act + US sovereignty narrative** is a federal-level cross-cutting theme that also affects TSMC AZ and the Micron HBM expansion.
- **18A and 14A vs TSMC N2** — if Intel sustains parity, the duopoly on leading-edge fab finally becomes real and reshapes the entire downstream supply chain.

## Sources

- [Intel Q4 FY25 Earnings (SEC)](https://www.sec.gov/Archives/edgar/data/0000050863/000005086326000009/q425earningsrelease.htm)
- [Intel Q1 FY26 8-K (SEC)](https://www.sec.gov/Archives/edgar/data/0000050863/000005086326000044/a02272026form8-kex991.htm)
- [Intel Q1 FY26 10-Q (SEC)](https://www.sec.gov/Archives/edgar/data/0000050863/000005086326000079/intc-20260328.htm)
- [Tech Insider: Intel Q1 2026 $13.6B revenue, DCAI +22%](https://tech-insider.org/intel-q1-2026-earnings-13-6-billion-revenue-data-center-surge/)
- [TheNextWeb: Intel joins Musk's Terafab](https://thenextweb.com/news/intel-terafab-elon-musk-foundry-partnership)
- [Wccftech: Intel 14A wins Tesla](https://wccftech.com/intel-14a-wins-tesla-major-customers-foundry-business-gamble-pays-off/)
- [Wccftech: Intel CEO calls foundry national treasure, 18A yield turnaround](https://wccftech.com/intel-ceo-lip-bu-tan-calls-foundry-a-national-treasure-as-external-customers-knock-on-his-door-after-18a-yield-turnaround/)
- [Tom's Hardware: 18A-P external interest](https://www.tomshardware.com/tech-industry/semiconductors/intel-ceo-recognizes-its-18a-node-for-external-customers-as-18a-p-gets-inbound-interest-company-cites-increasing-yields)
- [StorageReview: Panther Lake + Clearwater Forest on 18A](https://www.storagereview.com/news/intel-unwraps-core-ultra-series-3-panther-lake-and-xeon-6-clearwater-forest-on-intel-18a)
- [FinancialContent: Intel +7% on 18A + $5B NVDA backing](https://markets.financialcontent.com/stocks/article/marketminute-2026-4-1-intel-shares-surge-7-as-18a-shipments-and-5-billion-nvidia-backing-signal-turnaround-victory)

---

## SK Hynix — HBM leader

## Current state (May 2026)

SK Hynix sits at the center of the AI memory supercycle and was the single best-performing memory franchise of FY2025 and Q1 2026.

- **Q1 2026 earnings (record)**: Revenue ₩52.58 trillion (+60% QoQ, +198% YoY), operating profit ₩37.6 trillion at a **72% operating margin**, net profit ₩40.3 trillion. Q1 alone generated more operating profit than all of FY2024. Net cash position improved to ₩35 trillion.
- **DRAM pricing**: DRAM ASPs +mid-60% QoQ in Q1; NAND ASPs +mid-70% QoQ. TrendForce reports industry DRAM contract prices +90–95% QoQ in Q1 2026.
- **HBM market share**: ~57% revenue share / 62% shipment share as of late 2025 (Counterpoint). Supplies roughly **two-thirds of NVIDIA's HBM4 allocation** and ~70% of NVIDIA's current HBM business.
- **HBM3E**: Still the workhorse — analysts expect HBM3E to be ~two-thirds of 2026 HBM shipments. 12-Hi (36 GB) is the standard SKU shipping into Blackwell B200/B300 and AMD MI350. Customers signing 3–5 year LTAs at ~mid-$500/stack pricing.
- **HBM4**: Mass production system live since Sep 2025; NVIDIA validation cleared; volume ramp slipped to end of Q1 2026 because NVIDIA pushed per-pin speed above 11 Gbps for Rubin and all three suppliers had to redesign. SK Hynix first to show **16-Hi HBM4** at CES (>2.8 TB/s, 11 Gb/s), using TSMC 12 nm logic base die. Targets 16-Hi production in Q4 2026.
- **Cycle exposure**: DRAM is still roughly half the business and NAND is meaningful — but management calls this cycle 'structurally different' due to multi-year LTAs with hyperscalers; HBM capacity is sold out through CY2026.

## Capacity expansion

- **M15X (Cheongju)**: Flagship HBM expansion. Commercial production of 1b DRAM started **Feb 2026, four months ahead of plan**. Initial ~10k wpm ramping to **55–60k wpm by mid-2027**, fully dedicated to HBM3E/HBM4 DRAM. Total commitment ~$15.1 B (₩20 trillion). Second cleanroom equipment move-in began Dec 2025.
- **P&T7 (Cheongju advanced packaging)**: New fab, construction starts April 2026, full ops by end-2027. Brings total Cheongju AI-memory capex commitment to >$32 B.
- **Yongin cluster**: Phase 1 targeted end-2027; positioned for HBM5.
- **Industry capacity comparison (late 2025)**: Samsung ~170k wpm of HBM-relevant DRAM, SK Hynix ~160k wpm — Samsung is closing the unit-capacity gap, but yield + qualification keeps Hynix dominant on shipped revenue.
- **US ADR listing**: Confidentially filed March 2026 for 2026 debut.

## Key catalysts

- HBM4 volume ramp into NVIDIA Rubin (Vera Rubin spec calls for 288 GB HBM4 per GPU, ~3× Blackwell).
- 16-Hi HBM4 Q4 2026 production for Rubin Ultra.
- M15X cleanroom 2 equipment move-in / utilization curve.
- Sandisk + SK Hynix **High Bandwidth Flash (HBF)** standardization — first samples 2H 2026, devices early 2027. Hynix gets a NAND-stack adjacency to HBM without owning a NAND fab.
- Q1 2026 LTA wave: 3–5 year contracts with MS/Google/Meta lock in pricing through 2028+.
- US ADR listing as a multiple re-rating event.

## Risks

- **Customer concentration**: ~90% of HBM revenue ties to NVIDIA — any Rubin slip, China export tightening, or NVIDIA insourcing/ASIC mix shift hits hard.
- **Samsung HBM4 catch-up**: Samsung's 1c DRAM + 4 nm logic base die is technically more aggressive than Hynix's 1b/12 nm; if customers reward that in Rubin Ultra / Rubin Next, share could compress.
- **DRAM/NAND down-cycle re-entry**: Half the P&L is still cyclical commodity memory; the 'supercycle' thesis breaks if hyperscaler capex pauses in 2027.
- **Korean foundry context**: Samsung is the only domestic foundry for HBM logic bases; Hynix is structurally dependent on TSMC for the HBM4 logic die.
- **Capex digestion**: $32 B+ Cheongju + Yongin spend turns into depreciation drag if HBM ASPs reset.
- **Samsung reclaiming overall DRAM #1 in late 2025** (per Counterpoint) shows the non-HBM book is contestable.

## Cross-cutting

- HBF partnership with Sandisk (Feb 2026 OCP standardization kickoff) — Hynix is hedging the HBM monopoly by co-defining the NAND-stack tier for inference.
- Hynix is the anchor of the Korea–TSMC–NVIDIA HBM4 axis: 1b DRAM (Cheongju) + TSMC 12 nm logic die + NVIDIA Rubin packaging.
- 3–5 year LTAs with hyperscalers are an industry-wide reset shared with Samsung and Micron.

## Sources
- [SK Hynix Q1 2026 earnings (BigGo)](https://finance.biggo.com/news/KR_000660.KS_2026-04-24)
- [SK Hynix Q1 2026 results (StorageNewsletter)](https://www.storagenewsletter.com/2026/04/29/sk-hynix-fiscal-1q26-financial-results/)
- [CNBC: SK Hynix record Q1](https://www.cnbc.com/2026/04/23/sk-hynix-earnings-ai-memory-shortage-hbm-demand.html)
- [TrendForce: SK Hynix ~2/3 of NVIDIA HBM4](https://www.trendforce.com/news/2026/01/28/news-sk-hynix-reportedly-to-supply-about-two-thirds-of-nvidia-hbm4-samsung-targets-early-delivery/)
- [TrendForce: 12-layer HBM4 ramps, 16-layer push](https://www.trendforce.com/news/2026/01/09/news-nvidia-demand-fuels-hbm4-race-12-layer-ramps-16-layer-push-by-sk-hynix-samsung-and-micron/)
- [Tom's Hardware: HBM4 timeline slip](https://www.tomshardware.com/tech-industry/hbm4-mass-production-delayed-as-nvidia-pushes-memory-specs-higher)
- [SK Hynix 2026 outlook (corporate)](https://news.skhynix.com/2026-market-outlook-focus-on-the-hbm-led-memory-supercycle/)
- [Digitimes: M15X early ramp](https://www.digitimes.com/news/a20260410VL207/sk-hynix-production-dram-hbm-capacity.html)
- [The Elec: M15X 4 months early](https://www.thelec.net/news/articleView.html?idxno=5533)
- [TrendForce: P&T7 Cheongju packaging fab](https://www.trendforce.com/news/2026/01/13/news-sk-hynix-to-build-cheongju-advanced-packaging-fab-boosting-hbm-output-by-2027/)
- [FinancialContent: SK Hynix $15B HBM gambit](https://markets.financialcontent.com/stocks/article/marketminute-2026-2-25-sk-hynixs-15-billion-hbm-gambit-cementing-dominance-in-the-global-ai-memory-arms-race)
- [Introl: South Korea HBM4 Moment](https://introl.com/blog/south-korea-hbm4-stargate-memory-supercycle-2026)
- [Silicon Analysts: HBM pricing 2026](https://siliconanalysts.com/data/hbm-pricing)

---

## Micron — US HBM + DRAM

## Current state (May 2026)

Micron has turned its HBM3E execution into a structural re-rating. From a ~10% HBM share entering 2024, Micron leapfrogged Samsung to become **#2 in HBM**.

- **HBM market share**: ~21% (Counterpoint Q2 2025) — passed Samsung (17%) on the strength of 12-Hi HBM3E at 30% lower power than competitors. Q3 2025 Counterpoint reads SK Hynix 53% / Samsung 35% / Micron 11%, suggesting share is volatile as Samsung's NVIDIA qual comes online; consensus puts Micron at ~13–21% depending on quarter and methodology.
- **Customer qual**: 12-Hi HBM3E (36 GB) is the gold-standard SKU into NVIDIA Blackwell (B200/B300/GB200) and AMD Instinct MI350 (288 GB HBM3E). Micron is AMD's lifeline for MI350 share gains at Azure, Oracle, Meta.
- **HBM4**: Sampling at 11 Gb/s+; **entered high-volume production in Q1 calendar 2026 — one quarter ahead of management guidance**.
- **HBM book**: 'HBM capacity for CY2025 and CY2026 is fully booked' (Mehrotra, Dec 2025). Multi-year hyperscaler LTAs now span 3–5 years.

## Recent quarter (FQ2 FY2026, reported March 2026)

- Revenue **$23.86 B**, +196% YoY, +75% sequentially.
- Non-GAAP EPS **$12.20** (vs $8.79 consensus).
- **Gross margin 75%**, well above ~68% guide.
- Q1 FY2026 datacenter revenue +150% YoY.

## FQ3 FY2026 guidance (the eye-opener)

- Revenue **$33.5 B ± $750 M** — would be a record.
- Gross margin **~81%**.
- Non-GAAP EPS **$19.15 ± $0.40**.
- Operating expenses ~$1.40 B.
- Drivers: higher price, lower cost, favorable mix (HBM-heavy, exit Crucial consumer).

## Strategy shifts

- **Exited Crucial consumer brand** (announced Dec 3, 2025) to redirect all capacity to enterprise SSD / HBM / AI DRAM. eSSD revenue >$1.4 B in Q4 2025 (+41% QoQ); first to ship production PCIe Gen 6 datacenter SSD (Micron 9650).
- Developing high-DWPD SLC SSDs for KV-cache workloads.

## Capacity / CHIPS Act build-out

- **CHIPS Act direct funding**: up to **$6.4 B** total ($6.1 B for ID + NY fabs + $275 M Virginia expansion, amended June 2025).
- **Idaho (ID1, ID2)**: Accelerated. Reallocated ~**$1.2 B from NY to Idaho** in Nov 2025. ID2 construction starts 2026, operational by end-2028. DRAM output in Idaho begins **2027** — first US-made advanced DRAM.
- **New York (Clay)**: First fab groundbreaking Jan 2026; construction completes 2028; production circa **2030**. Up to 4 fabs / $100 B over 20+ years. NY GREEN CHIPS incentives up to $5.5 B.
- **Total US commitment scaled to ~$200 B** (largest US memory build-out).
- **FY2026 capex >$25 B**; FY2027 construction capex up >$10 B YoY (Taiwan Tongluo, Idaho, NY, Japan, Singapore, India).

## Margin gap vs. peers

- Micron's 75% gross margin (FQ2) is in striking distance of SK Hynix's 79% gross margin / 72% operating margin in Q1 2026. Gap is closing as HBM mix rises and Micron's bit cost on 1β DRAM drops.
- Versus Samsung memory: Micron's per-bit profitability is now higher on HBM, but Samsung's foundry+memory integration is a strategic moat Micron lacks.

## Key catalysts

- HBM4 ramp to NVIDIA Rubin — getting any meaningful share against SK Hynix's ~2/3 lock would be a multiple-expansion event.
- AMD MI350/MI450 attach rate; Micron is the de facto preferred AMD HBM supplier.
- US-fab DRAM/HBM coming online (Idaho 2027): qualifies Micron as the only US-controlled HBM source, a sovereign-supply premium.
- Multi-year LTAs at fixed/escalating prices flatten the cycle.
- Exit of Crucial frees ~15–20% of NAND wafers for enterprise SSD growth.

## Risks

- **Share-loss risk to Samsung HBM4**: Samsung's 1c DRAM + 4 nm logic die is technically ahead of Micron's HBM4 stack; if Samsung passes Rubin qual at scale, Micron's #2 spot is contestable.
- **NVIDIA allocation politics**: SK Hynix locked in ~2/3 of HBM4; remaining 1/3 splits between Samsung and Micron — Micron risks dropping to a thin slice.
- **CHIPS Act / political risk**: $6.4 B in federal commitments depend on continued bipartisan support; NY fab timeline is already long-dated to ~2030.
- **Cyclical re-set**: ~half of revenue is still standard DRAM/NAND — a hyperscaler capex pause hits even with LTAs.
- **Capex digestion**: $25 B+/year capex through FY2027 turns into D&A drag if HBM ASPs cool.

## Cross-cutting

- Micron + AMD is the counterweight to the SK Hynix + NVIDIA pair: AI compute duopoly is mirrored by an AI memory duopoly.
- HBM at 45% of B200 COGS = NVIDIA gross margins now driven more by HBM contracts than by TSMC wafer pricing — Micron's pricing power is a direct margin lever for the entire compute stack.
- US-fab HBM in Idaho 2027 = sovereign supply story alongside TSMC Arizona and Samsung Taylor.

## Sources
- [Micron FQ2 FY2026 prepared remarks](https://investors.micron.com/static-files/e089f8c0-065d-47b8-9d02-bfa863cdb357)
- [Micron FQ1 FY2026 prepared remarks](https://investors.micron.com/static-files/088991c5-a249-4f66-a0a6-258d9b66f3f9)
- [Futurum: Micron Q2 FY26 analysis](https://futurumgroup.com/insights/micron-q2-fy-2026-earnings-driven-by-ai-led-memory-demand/)
- [Tech-Insider: Micron Q2 FY26 record](https://tech-insider.org/micron-q2-2026-earnings-ai-memory-market/)
- [Investing.com: HBM sold out re-rating](https://www.investing.com/analysis/micron-faces-a-rerating-moment-as-soldout-hbm-supply-reshapes-the-earnings-story-200676155)
- [Micron 10-Q FY2026](https://www.sec.gov/Archives/edgar/data/0000723125/000072312526000006/mu-20260226.htm)
- [Tom's Hardware: Micron CHIPS reallocation to Idaho](https://www.tomshardware.com/pc-components/dram/microns-new-york-chipmaking-fabs-by-five-years-but-accelerates-second-fab-in-idaho-and-reallocates-chips-act-funding)
- [Digitimes: Micron CHIPS funds Idaho](https://www.digitimes.com/news/a20251111PD247/micron-chips-act-funding-fab-production.html)
- [Construction Owners: Micron NY on schedule, ID accelerated](https://www.constructionowners.com/news/micron-keeps-ny-fab-on-track-accelerates-idaho-expansion)
- [TrendForce: eSSD top-5 Q4 2025](https://www.trendforce.com/presscenter/news/20260313-12967.html)
- [FinancialContent: Micron 'NVIDIA moment'](https://markets.financialcontent.com/wral/article/marketminute-2026-1-1-microns-nvidia-moment-record-q1-2026-results-driven-by-insatiable-hbm-demand)
- [Silicon Analysts: HBM pricing 2026](https://siliconanalysts.com/tools/hbm-analysis)

---

## Samsung Memory — HBM laggard but huge

## Current state (May 2026)

Samsung's memory business spent 2024–2025 as the cautionary tale of the HBM era, but the late-2025 HBM3E qualification and aggressive HBM4 leapfrog has put 'Samsung is back' in the literal mouth of DS division head Jun Young-hyun (New Year 2026 address).

- **Reorg under Jun Young-hyun**: Jun (named DS division head May 2024, ascended to co-CEO) made rebuilding HBM credibility the centerpiece of his 2026 New Year address. Cited customers telling him 'Samsung is back' on HBM4. Pledged 'fundamental technology leadership in memory' + foundry scale-up.
- **HBM3E qualification with NVIDIA — finally cleared September 2025**, after an 18-month delay. Stock jumped >5% on the news. Initial supply was symbolic (~10k units, per TweakTown); actual material 12-Hi HBM3E shipments to NVIDIA began Q3 2025. **2026 HBM supply is sold out**.
- **HBM3E thermal issue root cause**: Samsung was on the older 1α DRAM node while Hynix/Micron moved to 1β — fixed but cost 18 months.
- **HBM4 leapfrog**: Most aggressive node mix in the industry — **1c (10 nm-class) DRAM + 4 nm logic base die from Samsung Foundry** (vs. Hynix's 1b DRAM + TSMC 12 nm). Reports of best-in-class NVIDIA test scores on speed and power in late 2025. Formal NVIDIA HBM4 supply contract expected Q1 2026; entry into NVIDIA supply chain expected Q2 2026. HBM4 logic die yield >90%; 1c DRAM yield ~50% (improving).
- **NAND/DRAM cycle co-exposure**: Samsung still has the broadest commodity-memory book. Samsung reclaimed #1 in overall DRAM revenue from SK Hynix in Q4 2025 (Counterpoint). DRAM contract prices +90–95% QoQ in Q1 2026 — Samsung is the biggest beneficiary of the broad DRAM tightening, not just HBM.
- **eSSD**: Still the #1 enterprise SSD vendor by revenue but ceding share — SK Hynix + Solidigm hit 30.2% in Q4 2025 (vs. Samsung's lead position narrowing). Samsung 176-layer QLC eSSD lineup fully rolling out for AI inference.

## Capacity expansion

- **HBM capacity**: +50% YoY in 2026, targeting **~250k wpm by year-end**. By absolute wafer count, Samsung may already be ahead of SK Hynix (~170k vs. ~160k wpm of HBM-relevant DRAM in late 2025) — the bottleneck is yield and qualification, not capacity.
- **1c DRAM ramp at Pyeongtaek P4**: 60k wpm Q4 2025 → +80k Q2 2026 → +60k Q4 2026, targeting **200k wpm 1c DRAM by end-2026**.
- **P5 Pyeongtaek**: Operational 2028.
- **Foundry**: 2 nm GAA mass production planned 2026 — strategic moat as the **only company with foundry + memory + advanced packaging** under one roof. Partnered with TSMC last year on HBM4 logic-die development (a hedge in case Samsung Foundry yield slips).

## Strategic shifts

- **3–5 year LTAs**: Samsung confirmed at March 2026 shareholder meeting it is pursuing 3–5 year multi-year contracts with hyperscalers (Microsoft, Google in advanced talks alongside SK Hynix). Industry-wide pivot away from quarterly negotiation.
- Stock hit an all-time high Jan 2, 2026 (₩128,500, +7.17% in a day). Morgan Stanley sees Samsung 2026 EPS +150% YoY.
- **Google TPU HBM3E**: Samsung supplies 60%+ of Google's TPU HBM3E and expected to remain primary in 2026 — a critical pocket of HBM dominance that doesn't depend on NVIDIA qual.

## Key catalysts

- HBM4 NVIDIA contract signing (Q1 2026) and Rubin shipment ramp Q2/Q3 2026 — if the leapfrog plays out, Samsung could materially erode Hynix's share into HBM4E.
- Foundry + memory + packaging 'one-stop' AI accelerator package wins (e.g., for hyperscaler ASIC programs).
- 1c DRAM yield curve — every yield point is direct gross-margin leverage.
- Continued Google TPU + Broadcom + AWS Trainium ASIC HBM supply.
- Long-term LTAs converting cyclical book to annuity.

## Risks

- **Execution risk on the leapfrog**: 1c DRAM yields at ~50% mean a node-level slip could re-open the 2024-style HBM credibility gap.
- **NVIDIA allocation already locked**: Hynix has ~2/3 of Rubin HBM4, so even successful Samsung qual yields a smaller-than-historical NVIDIA slice in the near term.
- **Samsung Foundry weakness contaminates the HBM4 logic base die story**: if 4 nm/2 nm yields disappoint, Hynix's TSMC-anchored HBM4 looks safer to customers.
- **NAND/DRAM cyclicality**: Bigger commodity book = bigger downside if hyperscaler capex pauses in 2027.
- **Korean labor / capex politics**: Pyeongtaek P5 timing has slipped before.
- **Foundry losses**: Memory is being asked to subsidize the broader DS division while foundry catches up.

## Cross-cutting

- Samsung is the only player whose HBM4 stack is fully vertically integrated (DRAM + foundry logic base die + packaging) — a structural differentiator vs. Hynix-TSMC and Micron-TSMC.
- The DRAM #1 reclaim in Q4 2025 means the AI memory narrative shouldn't bury the fact that Samsung's commodity book is also a major beneficiary of the 90% QoQ DRAM price surge.
- Samsung's Google TPU dominance is the under-discussed cross-cutting node: as ASICs grow from <10% to ~25% of AI accelerator volume by 2027, Samsung's Google franchise becomes a moat independent of NVIDIA.

## Sources
- [TrendForce: Samsung 12H HBM3E NVIDIA qual](https://www.trendforce.com/news/2025/09/22/news-samsung-12h-hbm3e-reportedly-clears-nvidia-tests-after-18-month-setback-hbm4-reaches-final-phase/)
- [Tom's Hardware: Samsung NVIDIA HBM3 certification](https://www.tomshardware.com/tech-industry/samsung-earns-nvidias-certification-for-its-hbm3-memory-stock-jumps-5-percent-as-company-finally-catches-up-to-sk-hynix-and-micron-in-hbm3e-production)
- [KED Global: Samsung HBM4 advances to mass output](https://www.kedglobal.com/korean-chipmakers/newsView/ked202512030011)
- [KED Global: Samsung 2026 HBM sold out](https://www.kedglobal.com/earnings/newsView/ked202510300005)
- [Sammy Fans: 'Samsung is back' HBM4](https://www.sammyfans.com/2026/01/02/samsung-is-back-hbm4-is-receiving-praise-from-customers/)
- [TrendForce: Samsung supplies 60%+ of Google TPU HBM3E](https://www.trendforce.com/news/2025/12/01/news-samsung-reportedly-supplies-60-of-google-tpu-hbm3e-set-to-remain-primary-supplier-in-2026/)
- [TrendForce: Samsung 3-5 year contracts](https://www.trendforce.com/news/2026/03/18/news-memory-giant-shifts-strategy-samsung-reportedly-eyes-3-5-year-contracts-to-stabilize-supply/)
- [TradingKey: Samsung & SK Hynix LTA pivot](https://www.tradingkey.com/analysis/stocks/us-stocks/261765299-samsung-sk-hynix-lta-memory-cycle-stock-beneficiary-tradingkey)
- [Techi: Samsung stock record on HBM4](https://www.techi.com/samsung-stocks-hit-record-high/)
- [Digitimes: Samsung HBM4 NVIDIA 2026](https://www.digitimes.com/news/a20251127PD231/samsung-hbm4-nvidia-2026-shipments.html)
- [Semicone: Samsung memory reform](https://www.semicone.com/article-345.html)

---

## Sandisk + Western Digital — enterprise NAND/SSD

## Current state (May 2026)

Western Digital and Sandisk separated on **February 21, 2025** (WDC kept HDD, Sandisk got NAND/flash; 1/3 SNDK share per WDC share). Both ex-parent and spin have become AI-storage darlings since.

### Sandisk (SNDK) — pure-play NAND + enterprise SSD
- **Stock**: +550% in 12 months post-spinoff; trading near $650/share mid-March 2026; added to S&P 500; ~75% Buy/Strong Buy.
- **FQ1 FY2026 (Nov 2025)**: Revenue **$2.31 B** (+21% QoQ, +23% YoY, beat guidance). GAAP EPS $0.75 / Non-GAAP EPS **$1.22** (up from $0.29). Gross margin **29.9%** (+350 bps QoQ).
- **FQ2 FY2026 guidance**: Revenue **$2.55–2.65 B**; Non-GAAP EPS **$3.00–$3.40** — a step-change driven by NAND scarcity pricing.
- **Datacenter revenue +26% sequentially**; 2 hyperscalers in qualification, third + top storage OEM planned for CY2026, engagement with 5 major hyperscalers.
- **BiCS8** 15% of bits shipped in FQ1; on track to be majority of bit production exiting FY2026.
- **Product**: 256 TB NVMe enterprise SSD demonstrated on UltraQLC platform (BiCS8 QLC CBA NAND + custom controllers).
- **eSSD revenue Q4 2025: $440 M (+64% QoQ)** — smallest of the top 5 but fastest growing.
- **High Bandwidth Flash (HBF) with SK Hynix**: Feb 25, 2026 OCP standardization kickoff. NAND-stack alternative to HBM for AI inference: bandwidth comparable to HBM (~1.6 TB/s) at **8–16× capacity** at similar cost. First samples 2H 2026; first AI-inference devices early 2027. Sandisk contributes BiCS NAND + CBA bonding; Hynix contributes TSV/HBM stacking. Sandisk took 'Most Innovative Technology' at Flash Memory Summit 2025.

### Western Digital (WDC) — pure-play HDD
- **Stock**: +180% as of March 2026 (+115% YTD per TIKR); +360% over 12 months. Bernstein upgraded to Outperform, target $340 (from $170).
- **FQ3 FY2026 (April 2026)**: Cloud segment **89% of revenue at $3.0 B (+48% YoY)**. Shipped **222 EB total** (199 EB nearline mass-capacity + 23 EB other). Client $179 M (+31%), consumer $186 M (+24%). Quarterly dividend +20% to $0.15; net cash position achieved.
- **FQ2 FY2026**: Revenue $3.02 B (+25% YoY); GAAP profit tripled to $1.84 B; shipped 215 EB. Non-GAAP gross margin **46.1%**; FQ3 guide 47–48%.
- **2026 HDD production fully sold out**; top-7 customer LTAs through 2026, multi-year deals to 2027–2028 — 'take-or-pay' contracts. WDC earns ~**$8.6 M per exabyte shipped**, ~2× Seagate's yield.
- **HAMR + ePMR roadmap (Innovation Day Feb 3, 2026)**: HAMR qual underway with two hyperscalers; **50 TB drives later 2026, 100 TB drives by 2029**. WDC acquired internal laser tech for HAMR supply control.
- **TCO vs. QLC SSD**: still 4–5× better — the 'AI library' tier on HDD.
- **April 2026 scare**: Storage stocks sold off on Google TurboQuant compression worries; Bernstein said 'zero impact to HDD demand' and the trade reversed.

## Enterprise SSD market share (Q4 2025, TrendForce top-5)

- **Samsung**: #1, full 176-layer QLC eSSD lineup rolling out.
- **SK Group (SK Hynix + Solidigm)**: 30.2% share (+340 bps QoQ); revenue $3.26 B (+75% QoQ). Solidigm 60 TB / 122 TB shipping; 244 TB planned.
- **Micron**: $1.4 B (+41% QoQ); 13.0% share (down from 14.3%); first PCIe Gen 6 production drive (9650).
- **Kioxia**: $1.16 B (+19% QoQ).
- **Sandisk**: $440 M (+64% QoQ).
- Korean companies (Samsung + SK Group) = **~64% combined eSSD share**.
- Top-5 combined Q4 2025 revenue: **$9.92 B (+52% QoQ)**; TrendForce projects 2026 eSSD revenue could double.

## Key catalysts

**Sandisk**
- HBF samples 2H 2026 → HBF inference devices early 2027 — first attempt to crack the HBM monopoly with a NAND tier.
- BiCS8 majority of bits by FY2026 exit lowers bit cost.
- 256 TB UltraQLC eSSD qualification at top hyperscalers in CY2026.
- 50–70% cumulative enterprise SSD price gains forecast through early 2026 — already +30–40% QoQ.

**Western Digital**
- HAMR qualification wins at hyperscalers (2 in flight) → 50 TB drives 2026.
- 2027/2028 LTA extensions during current bottleneck = pricing power.
- Continued nearline mass-capacity exabyte growth as AI training data persists on HDD.
- Margin expansion as UltraSMR mix grows.

## Risks

**Sandisk**
- NAND is cyclically more volatile than DRAM; if hyperscalers slow eSSD orders in 2027, ASP normalization is sharp.
- HBF is unproven — could be a NAND-tier curiosity rather than an HBM disruptor; first-mover ecosystem risk.
- Trailing the top 4 eSSD vendors on absolute scale; bargaining power with hyperscalers is structurally weaker.
- Stock has run 550% — execution miss meets multiple compression.

**Western Digital**
- HAMR yield/qualification slip would cede density race to Seagate (already further along on HAMR).
- QLC SSD price collapse could erode the 4–5× TCO advantage faster than HAMR can compensate.
- HDD is a duopoly but a structurally declining unit-volume market — story is exabytes per drive, not drives.
- AI compression algorithms (e.g. Google TurboQuant) sentiment risk even when fundamentally irrelevant.
- Capacity build-out depends on disciplined LTA pricing — any oversupply blink reprices the curve.

## Cross-cutting

- The HBF partnership ties Sandisk and SK Hynix into a non-DRAM AI memory stack — explicitly aimed at the inference tier where HBM capacity is the bottleneck.
- Industry-wide structural shift to 3–5 year LTAs (DRAM, NAND, HDD) is the through-line: storage is moving from commodity cycle to utility-like contract economics.
- HDD vs. QLC SSD TCO competition is the only place in the AI stack where the cost curve is going the wrong way for NAND.
- Sandisk + WDC together = the only US-domiciled pure-play exposure to AI storage growth without DRAM cyclicality.

## Sources
- [Sandisk FQ1 FY2026 press release](https://www.sandisk.com/company/newsroom/press-releases/2025/2025-11-6-sandisk-reports-fiscal-first-quarter-2026-financial-results)
- [Sandisk 10-Q FY2026 (April 2026)](https://www.sec.gov/Archives/edgar/data/0002023554/000162828026029401/sndk-20260403.htm)
- [WDC FQ3 FY2026 8-K press release](https://www.sec.gov/Archives/edgar/data/0000106040/000162828026028878/a4ex991-pressreleaseq326.htm)
- [Blocks and Files: WDC AI revenue rising](https://www.blocksandfiles.com/disk/2026/05/01/ai-demand-drives-wd-revenues-sky-high-with-more-to-come/5219131)
- [MLQ.ai: WDC 2026 HDD sold out](https://mlq.ai/news/western-digitals-2026-hdd-production-is-sold-out-as-ai-data-centers-drive-record-results/)
- [TIKR: WDC up 115% in 2026](https://www.tikr.com/blog/western-digital-stock-is-up-115-in-2026-heres-whats-driving-the-rally)
- [FinancialContent: WDC 2026 deep dive](https://markets.financialcontent.com/stocks/article/finterra-2026-3-5-western-digital-wdc-2026-deep-dive-the-ai-storage-renaissance-and-fair-value-re-rating)
- [TrendForce: top-5 eSSD vendors Q4 2025](https://www.trendforce.com/presscenter/news/20260313-12967.html)
- [FinancialContent: Sandisk pure-play spinoff](https://www.financialcontent.com/article/finterra-2026-3-16-the-return-of-a-storage-legend-a-deep-dive-into-the-sandisk-sndk-pure-play-spinoff)
- [WDC Form 8-K (Sandisk spinoff)](https://www.sec.gov/Archives/edgar/data/0000106040/000119312525033383/d847507d8k.htm)
- [Sandisk + SK Hynix HBF kickoff Feb 2026](https://www.sandisk.com/company/newsroom/press-releases/2026/2026-02-25-sandisk-and-sk-hynix-begin-global-standardization-of-next-generation-memory-solution-high-bandwidth-flash-hbf)
- [Tom's Hardware: HBF NAND-based HBM alternative](https://www.tomshardware.com/tech-industry/sandisk-and-sk-hynix-join-forces-to-standardize-high-bandwidth-flash-memory-a-nand-based-alternative-to-hbm-for-ai-gpus-move-could-enable-8-16x-higher-capacity-compared-to-dram)
- [Sedaily: SK Hynix narrows gap on enterprise SSD](https://en.sedaily.com/news/2026/03/14/sk-hynix-narrows-gap-with-samsung-in-enterprise-ssd-race)

---

## TSMC — leading-edge foundry

## Current state (May 2026)

TSMC is the structural choke point of the AI buildout. Q1 2026 revenue hit **$35.9B (+40.6% YoY)**, net income up 58% YoY to $18.2B, gross margin 66.2%. **HPC reached 61% of revenue** (up from 51% a year earlier; +20% QoQ), with smartphone at 26%. Advanced nodes (7nm and below) = 74% of wafer sales, 3nm = 25%. Management raised full-year 2026 revenue growth guide to **>30% USD** and capex to the **high end of $52–56B**.

**CoWoS — the actual AI bottleneck**: TSMC is scaling CoWoS from ~13K wpm at end-2023 → ~35K wpm late-2024 → ~75K wpm end-2025 → projected **~130K wpm by end-2026** (roughly 10x in 3 years). CEO C.C. Wei has acknowledged CoWoS is sold out through 2026 and oversubscribed into mid-2026 even after expansion. New Chiayi AP7 fab plus outsourcing to ASE/Amkor (ASE projects advanced packaging sales to double in 2026). HBM contract prices rising high-teens to low-20s% for 2026.

**N2 ramp**: Volume production began Q4 2025 at Fab 22 Kaohsiung, with Fab 20 Hsinchu following. Initial 40K wpm capacity for late 2025 expanding to **~100K wpm in 2026 and up to 200K wpm by 2027**. Yields tracking healthy per Oct earnings call; N2 price reportedly **~50% higher than N3**. Anchor customers: Apple (iPhone 18 Pro), Qualcomm, MediaTek, AMD. N2P confirmed for 2H26, A16 to follow. N2 dilution ~2–3% on FY26 gross margin; combined with overseas dilution = 4–6 pp headwind already baked into 2Q26 guide. Underlying Taiwan-only GM implied at ~68–72%.

**Geographic diversification**:
- **Arizona Fab 21 Ph1**: producing for Apple and Nvidia Blackwell already; Ph2 construction complete, equipment install Q3 2026, 3nm production **pulled in a full year to 2027** (from 2028) due to AI demand. Ph3 construction underway. $20B board-approved capital injection to TSMC Arizona. Total Arizona project: **$165B**, 5 fabs + 2 packaging + R&D center, targeting ~30% of TSMC's most advanced output in US. US wafer pricing premium 10%+; global pricing up 3–5% in 2026.
- **Japan Kumamoto JASM**: Fab 1 (12/16/22/28nm specialty) hit profitability for first time in Q1 2026 (NT$951M profit). Fab 2 **pivoted from 6nm to 3nm** ($17B investment) on Nvidia Vera Rubin demand.
- **Germany Dresden ESMC**: structural build complete, equipment move-in 2H 2026, production 2027 (28/22nm & 16/12nm FinFET). Q1 2026 loss of NT$278M during construction. Future advanced-node expansion under discussion.

**Subsidies**: Finalized US CHIPS award $6.6B; received NT$67.1B in cumulative subsidies through H1 2025. Trump admin exploring equity-for-subsidies conversion (already at 10% nonvoting Intel stake as template). Q1 2026 subsidies fell 98.6% YoY to NT$505M.

## Key catalysts
- CoWoS capacity unlock through 2026 → easing of >50-week AI server lead times.
- N2 ramp inflection (Apple A20 in iPhone 18 Pro, late 2026).
- Arizona Ph2 equipment install (Q3 2026) and Ph3 progress.
- 2H26 capex revision (already at $52–56B high end).
- N2P production start 2H26; A16 sampling.
- Potential Trump equity-stake deal terms.

## Risks
- **Taiwan geopolitical premium/discount**: ~85%+ of advanced capacity still in Taiwan despite Arizona/Japan/Dresden builds; advanced packaging (CoWoS) entirely Taiwan-based — Arizona AP1 unlikely to break ground before Q3 2026 and will start with SoIC not CoWoS.
- US foreign-fab pricing premium drives concentrated profitability back to Taiwan operations.
- Overseas-fab gross margin dilution (Arizona, Kumamoto Fab 2, Dresden) sustained through 2026–27.
- Trump-era equity-stake conversion in lieu of grants could reset economics.
- AI capex digestion risk if hyperscaler spend slips in 2027.
- N2 yield setbacks on derivative nodes (N2P, A16).
- HBM/CoWoS overcapacity risk by 2027–28.

## Sources
- [TSMC Q1 2026 Earnings — record results, raised guidance (MacroMicro)](https://en.macromicro.me/blog/tsmc-q1-earnings-call-rare-capacity-expansion-as-the-ai-megatrend-takes-shape)
- [TSMC Q1 2026: HPC 61% of revenue, raised FY guide >30% (BigGo)](https://finance.biggo.com/news/US_TSM_2026-04-16)
- [The CoWoS Crunch Ends — TSMC packaging expansion to 130K wpm (FinancialContent)](https://markets.financialcontent.com/wral/article/tokenring-2026-1-2-the-cowos-crunch-ends-tsmc-unleashes-massive-packaging-expansion-to-power-the-2026-ai-supercycle)
- [Inside the AI Bottleneck: CoWoS/HBM/2-3nm through 2027 (FusionWW)](https://info.fusionww.com/blog/inside-the-ai-bottleneck-cowos-hbm-and-2-3nm-capacity-constraints-through-2027)
- [TSMC begins volume production of 2nm-class chips (Tom's Hardware)](https://www.tomshardware.com/tech-industry/semiconductors/tsmc-begins-quietly-volume-production-of-2nm-class-chips-first-gaa-transistor-for-tsmc-claims-up-to-15-percent-improvement-at-iso-power)
- [TSMC N2P for 2H26, A16 to cement 2nm-class node (TrendForce)](https://www.trendforce.com/news/2025/10/16/news-tsmc-confirms-n2p-for-2h26-joins-a16-to-cement-2nm-class-as-major-long-lived-node/)
- [TSMC Q1 2026 Earnings — capacity-rule break (Silicon Analysts)](https://siliconanalysts.com/analysis/tsmc-1q26-earnings)
- [TSMC accelerates Arizona Fab 2 to 2027 3nm (TrendForce)](https://www.trendforce.com/news/2025/12/18/news-tsmc-reportedly-accelerates-arizona-2nd-fab-eyes-3q26-tool-install-2027-3nm-production/)
- [TSMC Kumamoto fab swings to profit in Q1 2026 (Taipei Times)](https://www.taipeitimes.com/News/front/archives/2026/05/18/2003857513)
- [TSMC Dresden enters structural build, equipment move-in 2H26 (TrendForce)](https://www.trendforce.com/news/2025/11/20/news-tsmc-dresden-fab-reportedly-wraps-structural-build-eyes-equipment-move-in-in-2h26/)
- [TSMC's $165B Arizona GigaFab (tech-insider.org)](https://tech-insider.org/tsmc-arizona-165-billion-expansion-gigafab-2026/)

---

## ASML — EUV lithography monopoly

## Current state (May 2026)

ASML closed 2025 with **revenue €32.7B and net profit €9.6B**. Q4 2025 revenue €9.7B was a record. **Q1 2026: net sales €8.8B at 53% gross margin**. **2026 revenue guidance raised to €36–40B** (some sources cite €34–39B), implying ~10–22% growth. GM guide 51–53% near term (High-NA dilution), targeting 56–60% by 2030. Long-term 2030 target €44–60B.

**Backlog and bookings**: Year-end 2025 backlog = **€38.8B**, equivalent to 1.2x 2025 revenue. Of this, **€25.5B is EUV**. Q4 bookings doubled estimates; **EUV capacity sold out through 2027**. Most large Q4 orders ship in 2027 not 2026. JPMorgan flagged ~20 EUV units in discussion with Samsung's P5 fab as potential 2026–27 catalyst.

**High-NA EUV adoption**: Moving from development to early commercial deployment. EXE:5200 accepted by **Intel for HVM (Intel 18A-P / 14A)**. Other customers (TSMC, Samsung) still in qualification — imaging and overlay meeting spec per management. Systems cost **$200–400M each**. Bernstein projects **44 EUV systems shipped to DRAM customers by 2028** (2x 2025).

**Low-NA EUV upgrade cycle**: Customers progressing from 4nm → 3nm → 2nm requires more EUV layers per wafer; the layer-count expansion drives unit-pull independent of new fabs. EUV in DRAM (HBM/DDR5) is a second-engine — SK Hynix, Micron, Samsung all expanding.

**China headwinds**: China collapsed to **19% of system sales** in Q4 2025 from **~36% Q4 2024** (and historic peak ~46%). Lost DUV-to-China revenue being replaced by higher-margin EUV to TSMC/Samsung/Intel/Korea — net positive for mix and margin despite revenue compression.

**Service revenue mix**: Service & field options is a growing recurring base (~25–30% of revenue range), providing stable margin profile underneath cyclical system shipments. Each installed EUV machine generates multi-million-dollar annual service revenue.

## Key catalysts
- Samsung P5 fab EUV order (~20 units, $4–8B potential).
- High-NA EUV unit deliveries ramp into 2027.
- TSMC capex revisions ($52–56B for 2026 high end).
- DRAM EUV adoption acceleration (HBM4, 12-Hi → 16-Hi).
- Intel 14A PDK 1.0 and 18A-P timing — drives High-NA pull.
- 2026 China policy clarity (US export-control negotiations).

## Risks
- China DUV revenue still trending down — could compress below 15% in 2026.
- US tightening on mature-node DUV (immersion) shipments.
- High-NA gross margin dilution near-term (51–53% guide).
- Customer concentration: TSMC + Samsung + Intel + SK Hynix + Micron drive virtually all EUV demand.
- Booking lumpiness: large Q4 2025 booking surge was 2027-weighted, so 2026 system revenue more visible than book-to-bill suggests.
- Intel 18A/14A execution slips would reduce High-NA pull.
- AI capex digestion risk into 2027–28.

## Sources
- [ASML's €38.8B Backlog — earnings & geopolitics (ad-hoc-news)](https://www.ad-hoc-news.de/boerse/news/ueberblick/asml-s-high-wire-act-earnings-geopolitics-and-a-38-8-billion-backlog/69141642)
- [ASML Backlog Hits 2027 as Bookings Double Estimates (TradingKey)](https://www.tradingkey.com/analysis/stocks/us-stocks/261527359-asml-earnings-analysis-revenue-order-tradingkey)
- [ASML Earnings Clear the Way for More Gains in 2026 (Yahoo Finance)](https://finance.yahoo.com/news/asml-earnings-clear-way-more-231300818.html)
- [Can High-NA EUV Adoption Accelerate ASML's Long-Term Revenue Growth? (Zacks via TradingView)](https://www.tradingview.com/news/zacks:569c53c5f094b:0-can-high-na-euv-adoption-accelerate-asml-s-long-term-revenue-growth/)
- [ASML: AI Momentum Sets a Floor for 2026 (Wolf of Harcourt Street)](https://www.thewolfofharcourtstreet.com/p/asml-ai-momentum-sets-a-floor-for)
- [ASML Q1 Report Pivots on Orders, Margins, China (ad-hoc-news)](https://www.ad-hoc-news.de/boerse/news/ueberblick/asml-s-q1-report-pivots-on-orders-margins-and-china-strategy/69144851)
- [ASML Investment Case: EUV Monopoly & Semi Capex Cycle (HeyGoTrade)](https://www.heygotrade.com/en/blog/asml-investment-case-euv-monopoly-semi-capex/)

---

## Semi-cap equipment — AMAT, LRCX, KLAC

## Current state (May 2026)

**Industry WFE 2026 = $140B+** per KLA management; total semiconductor capex projected at **~$200B in 2026 (+20% YoY)** from $166B in 2025. TSMC alone = $52–56B (+27–37%), Samsung ~$40B semi-only (+20%), SK Hynix +40%+, Micron +40%+, **Intel flat-to-down ($17B or less)**. Memory = 45% of 2026 capex. IDMs as a group declining ~9%.

**Applied Materials (AMAT)**: Q1 FY26 revenue $7.01B (-2.1% YoY) with operating income down 15.8%. Q2 FY26 set a quarterly record. Management **raised semiconductor equipment growth outlook from >20% to >30% for calendar 2026**. Levered to HBM (3–4x more wafer starts per delivered bit than standard DRAM), advanced packaging, and leading-edge logic deposition/etch. SK Hynix multi-year HBM partnership at AMAT EPIC Center. NEXX acquisition strengthens panel-level packaging. **China ~30% of revenue**; FY26 estimated $600M revenue loss from export controls; FY25 China revenue $8.53B (-16%). 2026/27 consensus growth: 9.3% / 19.2%.

**Lam Research (LRCX)**: Q2 FY26 revenue $5.34B (+22.1% YoY), Q3 guide $5.70B. Most exposed of the three to AI/HBM upcycle. **Advanced packaging revenue tripled from ~$1B in 2024 to projected >$3B in 2025**. Introduced VECTOR TEOS 3D system (Sept 2025) for 3D advanced packaging — chiplet/HBM-stack enablement. **China = 35% of Q2 FY26 revenue (peaked at 43% in Q1 FY26)** — highest concentration of the three. FY26 EPS growth consensus: 15.9%; Systems segment FY26 ~$12.57B (+9.3%).

**KLA (KLAC)**: Q2 FY26 record quarterly revenue $3.30B (+7.2% YoY) at 41.3% operating margin; GAAP net income $1.15B / EPS $8.68. **Process control share is ~7x the nearest competitor and gained 360bps since 2021**. **Took #1 in Advanced Wafer Level Packaging, +14pp share, +~70% YoY revenue growth**. Advanced packaging process control revenue projected to **nearly double from $635M (2025) to ~$1B (2026)** vs overall advanced packaging equipment market of **~$13B in 2026 (+30% YoY)**. KLA raised WFE 2026 outlook to >$140B and expects 2027 to exceed 2026. **China = 39.5% of Q1 FY26 revenue ($1.27B)** — but export-control impact estimated only $300–350M across 5 quarters. Barclays upgraded to Overweight specifically citing China-control insulation. 16 consecutive annual dividend hikes.

**Relative positioning summary**:
| Company | AI/HBM Levered? | China Risk | Margin Profile | Diff'd Position |
|---|---|---|---|---|
| AMAT | High (HBM, packaging) | Medium (~30%) | ~30% op margin | Deposition / etch / HBM |
| LRCX | Very High (HBM stacks, 3D pkg) | **High (35–43%)** | ~28–30% op margin | Etch / deposition / TEOS 3D |
| KLAC | High (process control everywhere) | High (~40%) but insulated | **41% op margin** | Process control monopoly |

**Advanced packaging tailwind quantified**: HBM moving from 12-Hi to 16-Hi/20-Hi stacks, HBM4 launching 2026 with 10-micron microbump pitch and 2048-bit interface — every layer increment adds wafer starts and process steps disproportionately benefiting deposition/etch/inspection.

## Key catalysts
- TSMC FY26 capex final number ($52–56B); CoWoS tool orders.
- Samsung P5 fab CapEx commitment.
- SK Hynix + Micron HBM expansion orders (both +40%+ capex).
- Intel 18A-P / 14A tool orders (if foundry strategy holds).
- US-China export-control negotiations (any easing = upside surprise).
- Advanced packaging market hitting $13B in 2026.

## Risks
- **China revenue cliff**: still 30–43% of revenue for the trio; further US export tightening could chop hundreds of millions more.
- **IDM capex declining ~9%** in 2026 — concentration on TSMC + memory makers (oligopsony pricing risk).
- Capex digestion if HBM oversupply emerges in 2027–28.
- Intel capex flat-to-down already; further cuts if foundry strategy retrenches.
- AMAT/LRCX more cyclical than KLAC; recent AMAT operating income decline shows mix sensitivity.
- Customer concentration: top 5 customers ~60–70% of revenue for each.

## Sources
- [KLA Q3 FY26 Letter to Shareholders (KLA IR)](https://d1io3yog0oux5.cloudfront.net/_254cfe708398b4db4cadd8b0b12e3748/klatencor/db/1117/10655/letter_to_shareholders/KLA+Shareholder+Letter+-+Q3+FY26.pdf)
- [KLA WFE 2026 Outlook Raised to $140B+ (BigGo)](https://finance.biggo.com/news/US_KLAC_2026-04-29)
- [Which Chip Equipment Stock Now Offers the Smartest Dip Buy? (Yahoo)](https://finance.yahoo.com/markets/stocks/articles/chip-equipment-stock-now-offers-135020785.html)
- [Will LRCX's China Revenue Drop Below 30% Hurt 2026 Outlook? (Globe and Mail)](https://www.theglobeandmail.com/investing/markets/stocks/AMAT/pressreleases/37040981/will-lrcxs-china-revenue-drop-below-30-hurt-2026-growth-outlook/)
- [Applied Materials Q1 FY26 8-K (SEC)](https://www.sec.gov/Archives/edgar/data/0000006951/000162828026007661/exhibit991q12026earningsre.htm)
- [AMAT Q2 FY2026 Results — semi equipment growth >30% (Applied Materials IR)](https://ir.appliedmaterials.com/news-releases/news-release-details/applied-materials-announces-second-quarter-2026-results/)
- [Can HBM and Packaging Demand Accelerate AMAT's Revenue Growth? (Yahoo)](https://finance.yahoo.com/markets/stocks/articles/hbm-packaging-demand-accelerate-amats-133600675.html)
- [Can Advanced Packaging Boost Lam Research Systems Sales? (Nasdaq)](https://www.nasdaq.com/articles/can-advanced-packaging-boost-systems-sales-lam-research-fy26)
- [2026 Semiconductor CapEx to Increase 20% (Electronics Weekly)](https://www.electronicsweekly.com/news/business/semiconductor-capex-2026-04/)
- [Capex Up for Foundry, Memory (Semiconductor Intelligence)](https://www.semiconductorintelligence.com/capex-up-for-foundry-memory/)

---

## Foundry alternatives — Samsung + Intel

## Current state (May 2026)

The TSMC alternatives remain structurally weaker but show signs of life in 2026. **TSMC commands ~70% global foundry revenue share** (Q2 2025 record 70.2% per TrendForce); Samsung remains #2 at ~7.3%; Intel Foundry is still pre-credibility for external scale.

### Intel — 18A in the make-or-break window

**Production status**: Intel 18A reached HVM late 2025 at Fab 52 in Chandler, AZ (Intel's 5th high-volume fab on Ocotillo campus). Panther Lake first SKU launched late 2025, broad availability **January 2026** — delayed from original 2025 promise. Fab 62 still under construction, will ramp when 18A demand justifies. **Yields ~60%+** — adequate for Panther Lake but below TSMC's 70–80% at N2 launch (and far above Samsung SF2's reported sub-40% earlier).

**Foundry customer wins** — finally non-trivial:
- **Apple (per KeyBanc analyst John Vinh)**: low-end M-series for MacBook/iPad on 18A, production targeted **2027**.
- 14A: **two prospective customers** with PDK access; firm decisions expected 2H 2026 → 1H 2027.
- Foundry strategy in flux: CFO Zinsner said Intel is reconsidering external 18A and pushing **18A-P as the real foundry process** (PDK 1.0 timing critical).

**Internal product flag**: **>90% of Nova Lake desktop CPUs will be on TSMC N2**, not Intel fabs — a clear vote of no-confidence from Intel's own product groups in 18A capacity/economics.

**Government overhang**: Trump admin took **10% nonvoting equity stake** in Intel in lieu of grants; warrants for up to 241M additional shares at $20 exercisable if Intel ceases to own ≥51% of foundry. Final CHIPS award $7.86B (down from $8.5B preliminary); $2.2B disbursed pre-Trump. Magdeburg Germany fab paused/cancelled.

### Samsung Foundry — late but moving

**2nm GAA mass production began Nov 3, 2025**. **Yields 55–60%** (up from reported 30% earlier). First-gen SF2 vs Samsung's own 3nm gen-2: +5% performance, +8% power efficiency, -5% area. Q1 2026 fab utilization >80% — first time in a year. Foundry biz targeting double-digit revenue growth and improved profitability in 2026; **breakeven not expected until ~2027** when Taylor, TX plant ramps.

**Customer base — now broader than Samsung itself**:
- **Tesla** ($16.5B deal previously signed) — most-cited anchor.
- Samsung Exynos 2600 (internal) in 2nm production.
- **DeepX** (Korean AI startup) at 2nm.
- **Charbright** (4nm) and **Anaplash** (28nm) — US AI startups.
- Talks with major US and Chinese customers; 2nm order growth guided **30%+** (some reports cite 130% YoY).
- 2nm capacity projected to **more than double by end 2026**.
- SF2P (gen-2 2nm) sampling, SF2P+ planned within 2 years, 1.4nm targeting 2029.
- CHIPS Act final award: **$4.75B** (cut 26% from preliminary $6.4B) — among the largest pct cuts; subsidy/investment ratio still ~13%.

### Rapidus (Japan) — outside shot

IIM-1 Chitose pilot line operational; **2nm GAA test wafers running** with planned electrical characteristics achieved. ASML High-NA EUV installed. IBM partnership: ~150 Rapidus engineers trained in Albany, ~80 returned to Hokkaido; ~10 IBM engineers on-site permanently. **Mass production target 2027** at initial 6,000 wpm scaling to 25,000 wpm year 1. **Funding stacked**: ¥267.6B private + government round; **additional $4B (¥631.5B) METI approval** — Japanese government became largest shareholder with 11.5% voting + golden share. **>60 prospective customers** in discussion (small-volume, fast-turn positioning vs. TSMC scale model). Two years behind TSMC/Samsung at launch.

### CHIPS Act + EU Chips Act disbursement reality

- **US CHIPS Act**: Final awards Intel $7.86B / TSMC $6.6B / Samsung $4.75B / Micron $6.2B (total ~$33B finalized of $52.7B authorized). Actual disbursements lag — Intel $2.2B disbursed; TSMC NT$67.1B in H1 2025 alone. Trump admin renegotiating, converting grants to equity.
- **EU Chips Act**: €43B mobilization target (now €80B claimed); actual EU-level public funds **only ~€4.5B from EU programmes + €1.4B other + €2.1B equity**. Member states fund the bulk (~€11B for ESMC/Dresden, originally ~€11B for Intel Magdeburg now cancelled). **Bruegel May 2026: "has underdelivered"**. **Chips Act 2.0 proposed Q1 2026, scheduled Q2 2027**. STMicro Catania SiC plant on track for 2026 completion (€293M RRF).

## Key catalysts
- Intel 14A binding customer commits (2H 2026 → 1H 2027).
- Intel 18A-P PDK 1.0 timing.
- Apple M-series on Intel 18A in 2027 (proof of foundry viability).
- Samsung 2nm utilization climb past 80%.
- Samsung Taylor, TX ramp.
- Rapidus 2nm pilot → mass production decision (2027).
- US-government equity-conversion deal terms for TSMC/Samsung/Micron.
- Chips Act 2.0 EU legislative proposal.

## Risks
- **Intel 18A could be optimized only for Intel** — 18A-P slip = customer attrition.
- Samsung historic pattern: announce 2nm wins, then lose them at scale (Qualcomm, Nvidia precedent).
- Samsung GM dilution from sub-scale 2nm + Taylor ramp.
- Rapidus dependent on continuous Japanese government refunding.
- EU Chips Act actual disbursement remains slow; centralized €20B fund only a recommendation.
- Trump equity-stake template could be extended to Samsung/TSMC, complicating capital structures.
- Intel could exit foundry: "slow or cancel 14A" explicitly on table per management.
- Nova Lake on TSMC = Intel's own product groups vote no-confidence.

## Sources
- [Intel 18A and 14A Bets Face Make-or-Break Year (Winbuzzer)](https://winbuzzer.com/2026/03/17/intels-18a-14a-roadmap-2026-foundry-panther-lake-xcxwbn/)
- [Intel Foundry: The Last Chance (Electronics Weekly)](https://www.electronicsweekly.com/foundry/intel-foundry-the-last-chance-2026-05/)
- [Analyst: Intel's Foundry Unit Wins Some Apple Business (Mark LaPedus)](https://marklapedus.substack.com/p/analyst-intels-foundry-unit-wins)
- [Intel Unveils Panther Lake on 18A (Intel Newsroom)](https://newsroom.intel.com/client-computing/intel-unveils-panther-lake-architecture-first-ai-pc-platform-built-on-18a)
- [Samsung Reportedly Hits 55–60% 2nm Yields (Design & Reuse / TrendForce)](https://www.design-reuse.com/news/202529730-samsung-reportedly-hits-55-60-2nm-yields-eyeing-an-edge-through-early-gaa-deployment/)
- [Samsung Foundry Expects 30%+ 2nm Order Growth in 2026; 1.4nm by 2029 (TrendForce)](https://www.trendforce.com/news/2026/01/29/news-samsung-foundry-reportedly-expects-30-2nm-order-growth-in-2026-1-4nm-set-for-2029/)
- [Samsung Foundry 80% Utilization in 1Q2026 (SemiWiki)](https://semiwiki.com/forum/threads/more-clients-leads-to-80-utilization-at-samsung-foundry-in-1q2026.24627/)
- [Rapidus secures $1.7B; over 60 customer talks (Tom's Hardware)](https://www.tomshardware.com/tech-industry/semiconductors/rapidus-secures-1-7-billion-from-japans-government-and-private-investors)
- [Japan Backs Rapidus with $4B (TheAIWorld)](https://theaiworld.org/news/japan-backs-rapidus-with-4b-to-lead-2nm-chip-race)
- [IBM Backs Rapidus as Funding Momentum Builds (TrendForce)](https://www.trendforce.com/news/2026/02/18/news-japans-chip-push-in-spotlight-ibm-backs-rapidus-as-funding-momentum-builds/)
- [Silicon Renaissance: CHIPS Act Enters Production Era (FinancialContent)](https://markets.financialcontent.com/wral/article/tokenring-2026-1-1-the-silicon-renaissance-us-chips-act-enters-production-era-as-intel-tsmc-and-samsung-hit-critical-milestones)
- [US Mulls Equity Stakes in CHIPS Act Recipients (TrendForce)](https://www.trendforce.com/news/2025/08/20/news-u-s-reportedly-mulls-stakes-in-chips-act-recipients-after-intel-raising-risks-for-tsmc-samsung/)
- [Intel FY2026 Q1 10-Q — Warrants for 241M shares (SEC)](https://www.sec.gov/Archives/edgar/data/0000050863/000005086326000079/intc-20260328.htm)
- [A World of Chips Acts (CSIS)](https://www.csis.org/analysis/world-chips-acts-future-us-eu-semiconductor-collaboration)
- [SEMI Europe Chips Act Report](https://www.semi.org/sites/semi.org/files/2025-11/SEMI_Chips_Act_Report_Full_Report.pdf)
- [Chips Act 2.0: From Subsidies to Ecosystem Competitiveness (DigitalEurope)](https://www.digitaleurope.org/resources/chips-act-2-0-from-subsidies-to-european-ecosystem-competitiveness/)

---

## DC REITs — DLR, EQIX

## Current state (May 2026)

The two listed pure-play DC REITs are running at record demand with AI now the binding constraint on every quarter's leasing print.

**Digital Realty (DLR) — Q1 2026 (reported Apr 23, 2026)**
- Core FFO $2.04, +15% YoY; FY26 core FFO guide raised to $8.00–$8.10.
- Total leasing bookings $707M annualized (100% share), $423M at DLR share — 2nd-highest quarter ever, ~70% above the next-highest.
- Largest lease in company history: 200 MW AI inference deal with a AA-rated hyperscaler in Charlotte (first hyperscale deployment in that market).
- 0–1 MW + interconnection bookings $98M, +40% YoY, a record; 21% of signings were AI-oriented.
- Backlog: $1.8B / $1.0B at DLR share. Development pipeline +60% to $16.5B, 1.2 GW under construction, 61% pre-leased.
- Cash renewal spreads guided 6.5%–8.5%; power-based occupancy expected +50–100 bps from YE25.
- Energy strategy moving from PPAs to 24/7 hourly matching and exploring hydrogen fuel cells.

**Equinix (EQIX) — Q1 2026**
- Revenue $2.444B, +10% reported / +8% normalized cc. MRR +12%. Adjusted EBITDA $1.245B at a **record 51% margin**.
- AFFO $1.065B (+12%), $10.79/sh.
- FY26 guide raised across the board: revenue $10.144–$10.244B (+10–11%), AFFO $4.198–$4.278B (+12–14%).
- ~60% of largest Q1 deals were AI-related (consistent with prior quarter); 8 of top 10 AI model providers and 4 of top 5 neoclouds are expanding with Equinix.
- Liquid-cooling deployments ~+50% QoQ; active engagements in all regions.
- 46 major projects across 32 markets, including 6 xScale hyperscaler builds. FY26 capex ~$4.1B.
- Hampton xScale customer terms re-cut, shifting some economics into Q2; 25% of FY26 retail expansion already sold.
- 90%+ hedged on 2026 energy costs.

**Pricing power / power-based pricing**
- Industry has clearly shifted from $/sqft to $/kW. DLR's 200 MW Charlotte deal is the cleanest example — the headline number is megawatts, not square feet. Cash renewal spreads of 6.5–8.5% (DLR) confirm landlords still have pricing power on rolls.
- Power-based occupancy (not space-based) is now the operating KPI both REITs guide.

**Hyperscaler-owned vs. leased mix**
- Hyperscalers still self-build for the largest training campuses (Meta's Hyperion, Microsoft's Fairwater, Google's own fleet), but **leased** capacity is essential for: (a) the inference layer closer to users, (b) interconnect/edge metros, and (c) speed-to-market where lead times for power and gear make in-house builds 3+ years out.
- DLR's 200 MW AA-rated hyperscaler lease was explicitly **inference-oriented** — a meaningful tell that hyperscalers are leasing for inference even as they build for training.
- Equinix's xScale (hyperscale JV product) plus its retail/interconnect business positions it on both sides of the trade.

**Alternative listed DC REITs / portfolios**
- **Iron Mountain (IRM) data center**: 32 MW leased through April 2026; 400 MW of capacity energizing over next 24 months. Operating portfolio 507.2 MW at 97.2% leased (Q1 2026). Chennai CHN-1 (23 MW) and Miami District 12 coming online in 2026.
- **Switch**: Taken private 2022 by DigitalBridge + IFM at $34.25/share ($11B). Now scaling Tier 5 footprint with a new $3B Nevada AI campus (per DigitalBridge commentary) and plans for 11M+ sqft expansion through 2030.
- **Vantage Data Centers** (DigitalBridge + Silver Lake portfolio): $6.4B 2024 equity raise; total DBRG portfolio capex ~$43B through end-2026. Flagship: **Frontier**, a $25B, 1.4 GW campus in Shackelford County, TX — 10 buildings, 3.7M sqft, designed for 250+ kW racks; first building H2 2026. Also scaling Nevada (224 MW), Ohio (192 MW), Zaragoza.
- **DigitalBridge (DBRG)**: 5.4 GW operating or under construction across portfolio — the listed proxy for private DC infra.

**Private AI "neocloud" market (GPU-as-a-Service)**
- **CoreWeave (CRWV)** — went public March 2025. Q1 2026 revenue $2.078B (more than 2x YoY from $982M). Revenue backlog ~**$100B** (vs $66.8B at YE25); $8.5B DDTL 4.0 facility closed Mar 31, 2026 (first IG-rated HPC DDTL); $3.1B DDTL 5.0 closed May 18, 2026. **>1 GW of active power**; targeting 8+ GW by 2030. Operating loss $144M, net interest expense $536M — still burning, financed by GPU-collateralized debt.
- **Crusoe** (private). Valued >$10B after Oct 2025 Series E (~$1.375B, co-led by Valor + Mubadala). Total raised $3.8B. Revenue trajectory: $276M (2024) → $998M (2025) → ~$2B (2026E). Building the 1.2 GW Stargate campus for OpenAI in Abilene TX ($12B), a 1.8 GW WY campus, a 900 MW Microsoft Abilene campus, and Project Jade (2.7 GW in Cheyenne). 2026 IPO rumored — hired Michael Gordon (ex-MongoDB COO/CFO) Dec 2025.
- **Lambda** (private). Hired Morgan Stanley, JPM, Citi for an IPO targeted as early as H1 2026.

## Key catalysts
- DLR/EQIX FY26 guide raises imply 2H26 leasing visibility is high; watch Q2 2026 prints for confirmation of power-based occupancy lift.
- Crusoe and Lambda IPOs in H2 2026 would reset the comp set for both REITs and neoclouds — CoreWeave traded ~7x forward revenue at IPO; Crusoe at $2B FY26E implies ~$14B at the same multiple, well above current $10B mark.
- 200 MW+ single-tenant inference leases (DLR template) becoming a recurring deal type — expect EQIX, Vantage, QTS (private under Blackstone) to ink similar.
- NVIDIA Vera Rubin (NVL144, ~600 kW/rack, 45°C warm-water cooling) shipping H2 2026 — pulls forward demand for purpose-built AI capacity and lengthens the demand tail.

## Risks
- Power and grid interconnection lead times (3–7 years for new substations in major metros) are now the gating constraint, not capital.
- Lease economics could flatten if 2027 brings a glut of speculative neocloud capacity, especially in TX/AZ/NV.
- Hyperscalers continue self-building training campuses; if inference also gets pulled in-house, lease demand could compress.
- Neocloud credit risk: CoreWeave's $100B backlog assumes durable customer demand, but balance sheet remains levered (interest expense $536M/qtr).
- Permitting + community opposition rising (esp. VA, OH).
- Energy procurement competition with utilities and other industrials is pushing power costs higher; EQIX's 90%+ hedge insulates margin but is a temporary advantage.

## Sources
- [Digital Realty (DLR) Q1 2026 Earnings Transcript — The Motley Fool](https://www.fool.com/earnings/call-transcripts/2026/04/23/digital-realty-dlr-q1-2026-earnings-transcript/)
- [DLR Q1 2026: Record Leasing, 200 MW Charlotte Inference Deal — BigGo Finance](https://finance.biggo.com/news/US_DLR_2026-04-23)
- [Digital Realty Trust Rides Record AI Leasing Wave — TipRanks](https://www.tipranks.com/news/company-announcements/digital-realty-trust-rides-record-ai-leasing-wave)
- [Equinix Q1 2026 Earnings Call Transcript — Insider Monkey](https://www.insidermonkey.com/blog/equinix-inc-nasdaqeqix-q1-2026-earnings-call-transcript-1750991/)
- [Equinix raises 2026 outlook; Hampton xScale timing — Seeking Alpha](https://seekingalpha.com/news/4582475-equinix-raises-2026-total-revenue-growth-outlook-to-10-percentminus-11-percent-while-shifting)
- [Iron Mountain Q1 2026 8-K — SEC](https://www.sec.gov/Archives/edgar/data/0001020569/000102056926000036/q12026earningspressrelea.htm)
- [DigitalBridge & Silver Lake $6.4B into Vantage — Blackridge Research](https://blackridgeresearch.com/news-releases/digitalbridge-and-silver-lake-to-invest-usd-64-billion-into-vantage-data-centers-us-eme/)
- [Vantage $25B Frontier 1.4 GW TX campus — DigitalBridge IR](https://ir.digitalbridge.com/news-releases/news-release-details/digitalbridge-backed-portfolio-company-vantage-data-centers)
- [CoreWeave Q1 2026 Earnings Press Release — SEC 8-K](https://www.sec.gov/Archives/edgar/data/0001769628/000176962826000220/coreweave1q26earningspress.htm)
- [CoreWeave $8.5B DDTL 4.0 Facility — SEC 8-K](https://www.sec.gov/Archives/edgar/data/0001769628/000176962826000129/ex991.htm)
- [Crusoe valuation, funding, IPO plans — Sacra](https://sacra.com/c/crusoe/)
- [Crusoe $1.375B Series E — Data Center Dynamics](https://www.datacenterdynamics.com/en/news/crusoe-raises-1375bn-in-latest-funding-round/)
- [Crusoe monitored for 2026 IPO — ION Analytics](https://ionanalytics.com/insights/mergermarket/crusoe-monitored-for-2026-ipo-as-company-evaluates-options/)
- [DigitalBridge 5.4 GW capacity — DCD](https://www.datacenterdynamics.com/en/news/digitalbridge-has-54gw-of-data-center-capacity-in-operation-or-under-construction/)

---

## Cooling — Vertiv + liquid cooling

## Current state (May 2026)

Liquid cooling is no longer optional for new AI capacity. Dell'Oro pegs the liquid-cooling market at ~$3B in 2025 (nearly 2x YoY) and ~$7B by 2029. 451 Research's Nov 2025 survey: only 45% of DCs are purely air-cooled (down from 48% in 2024); 59% plan to deploy liquid within 5 years. NVIDIA's GB200 NVL72 (120 kW/rack) and GB300 NVL72 are already liquid-only; **Vera Rubin NVL144 ships H2 2026 at ~600 kW/rack with 45°C warm-water cooling** — high enough that dry coolers replace mechanical chillers, a multi-year tailwind for the warm-water DTC stack.

**Technology stack: DTC vs. immersion**
- **Direct-to-chip (DTC) is the winner for the mainstream.** Single-phase DTC fills the 100–175 kW/rack density band. Deploys rack-by-rack, works with existing chilled-water plant, no facility rebuild. Residual VRM/DIMM/drive heat still needs supplemental airflow, so DTC is hybrid not fully liquid — acceptable trade-off.
- **Immersion** remains niche. Single-phase immersion captures ~100% of IT heat (PUE 1.02–1.10) but requires full facility rebuild and modified server form factors. Big 2025 unlock: Shell became first immersion-fluid provider to get Intel chip-warranty certification for 4th/5th-gen Xeon (May 2025).
- **Two-phase DTC** (e.g., Accelsius NeuCool from Bell Labs) still in pilot — gets serious when chip TDP/flux exceeds single-phase practical limits, likely 2027+.

**Vertiv (VRT) — Q1 2026**
- Revenue **$2.65B, +~30% YoY**. Adjusted EPS $1.17 (+83% YoY). FCF $653M in the quarter; near-zero net debt.
- Adjusted operating margin **+430 bps to 20.8%** — value-based pricing on high-barrier liquid cooling, fixed-cost leverage on growing revenue base, raw materials stabilizing.
- **Backlog >$15B** (more than doubled), 12–18 months of forward revenue; 24–36-month order pipeline visible.
- FY26 guide raised to **$13.5–$14.0B** revenue (~30% organic growth, ~51% EPS growth). Q2 guide $3.25–$3.45B (back-half weighted as Blackwell ramps).
- Acquired Strategic Thermal Labs (Apr 27, 2026) — extends thermal chain from server-side to facility infrastructure.
- Deep NVIDIA collaboration; Liebert CDUs + XDU coolant distribution units are reference designs for hyperscaler liquid-cooled racks.
- Forward P/E ~53x — pricing for execution.

**CDU + cold-plate makers**
- **CoolIT Systems** (private, KKR-backed; Jason Waxman now CEO) — clearest pure-play DTC leader. Scale advantage and proven HPC pedigree make it the prime IPO/acquisition candidate behind Vertiv.
- **Boyd Corp.** (Goldman Sachs PE-owned) — long-standing thermal interface and cold-plate supplier, big OEM customer base.
- **Asetek** (listed) — slot-in DTC supplier, smaller scale.
- **Accelsius** — two-phase, optionality on next thermal regime.
- **Motivair** — acquired by Schneider Electric (Q4 2024) to round out DTC/CDU stack inside Schneider's data-center systems business.

**Server-side rack assembly (liquid-cooled ODM/OEM)**
- **Supermicro (SMCI)** — claims **>2,000 liquid-cooled racks deployed**; sampling GB200 NVL72 since late Q4 2024; GB300 NVL72 in production. End-to-end LC stack from cold plates through CDU. Margin profile compressed vs. Vertiv (pure thermal play) but revenue scale is much larger.
- **Quanta Computer (QCT)** — shipping GB300 systems since Sep 2025. Long-time hyperscaler ODM with the biggest manufacturing footprint.
- **Foxconn, Wiwynn, Inventec** — meaningful share but lower visibility.
- CoreWeave alone ordered ~$2.3B of GB200 NVL72 systems for 2025 — most via Supermicro/Dell channels.

**Adjacent thermal plays**
- **nVent (NVT) — Q1 2026**: Revenue $1.242B, +53% YoY. Adj EPS $1.09, +63%. **Backlog $2.6B.** Organic growth ran +34% in Q1; FY26 organic guide raised to +21–23%. White-space liquid cooling was the standout. New Minnesota facility doubles LC production in early 2026. Added to NVIDIA partner network Q3 2025.
- **Modine (MOD)** — Q3 FY26 Climate Solutions +51% (data center +78%); Q4 FY26 sales +47%. **Landmark $4B chiller supply agreement signed May 2026** with a major hyperscaler covering 2027–2029, including a $165M upfront capacity payment. Visibility extended to ~5 years; LT growth 50–70%/yr for next two fiscal years. Plans ~20 chiller lines by early FY28 (125% cumulative capacity expansion). Spinning off legacy Performance Technologies via RMT with Gentherm (Q4 2026 close) → pure-play Climate Solutions co.
- **Munters** (Swedish-listed) — air handling, evap cooling, DTC peripherals; smaller but real beneficiary. Less disclosed data in latest cycle.
- **Aaon (AAON)** — rapid AI-driven growth on bespoke hyperscaler designs.
- **Comfort Systems USA (FIX)** — mechanical contractor that installs all of this.

**Thermal interface materials (TIMs)**
- Honeywell, Henkel, Dow, Shin-Etsu, and Indium Corp on standard pads/greases; Boyd and Laird (DuPont) for engineered interfaces. Volumes scale with cold-plate units shipped — derivative play on Vertiv/CoolIT/Boyd CDU growth.

## Key catalysts
- **NVIDIA Vera Rubin NVL144 GA in H2 2026** at 45°C warm-water — pulls dry-cooler-only designs forward (PUE benefit, no chillers), favoring vendors with warm-water stack (Vertiv, CoolIT, Modine Airedale).
- Modine's $4B hyperscaler chiller deal sets a template — expect similar long-dated supply pacts for nVent, Vertiv, CoolIT.
- Two-phase immersion or two-phase DTC could break through if Blackwell Ultra / Rubin successors push thermal flux beyond single-phase ceiling (>~250 kW/rack practical limit).
- Vertiv Q2 print (Aug 2026) will test the back-half-weighted guide; any beat reinforces the multiple.
- Possible CoolIT IPO or Vertiv acquisition would be a major comp event.

## Risks
- Hyperscaler capex pause/reset → fastest hit to Vertiv backlog given short conversion (12–18 mo).
- Vertiv 53x forward P/E leaves no room for misses.
- Two-phase tech leapfrog could erode incumbent CDU IP.
- Coolant fluid supply (single-phase dielectrics, PG, etc.) and copper cold plate bottlenecks.
- Chip warranty + leak/serviceability liability still a deployment friction at scale.
- EMEA softness flagged in Vertiv Q1.

## Sources
- [Vertiv Q1 2026 8-K — SEC](https://www.sec.gov/Archives/edgar/data/0001674101/000167410126000006/exhibit991vrt02112026.htm)
- [Vertiv VRT Q1 2026 release analysis — Uncle Stock Notes](https://unclestocknotes.substack.com/p/vertiv-vrt-2026-q1-earning-release)
- [Vertiv extends 2026 rally — Alphastreet](https://news.alphastreet.com/vertiv-holdings-nysevrt-extends-2026-rally-after-64-surge-ai-data-center-demand-and-cooling-backlog-in-focus/)
- [Dell'Oro: DC Liquid Cooling to approach $7B by 2029](https://www.delloro.com/news/data-center-liquid-cooling-market-to-approach-7-billion-by-2029-as-ai-deployments-accelerate/)
- [Direct-to-chip vs immersion deep dive — Data Center Frontier](https://www.datacenterfrontier.com/sponsored/article/55238785/park-place-technologies-immersion-or-direct-to-chip-a-comparison-of-the-most-common-liquid-cooling-technologies)
- [Top 10 Direct-to-Chip Cooling Companies — Data Centre Magazine (Apr 2026)](https://datacentremagazine.com/top10/top-10-direct-to-chip-cooling-companies-22-04-2026)
- [Schneider Electric on direct-to-chip for AI](https://blog.se.com/datacenter/2026/01/29/the-rise-direct-to-chip-cooling-top-ai-cooling-system/)
- [nVent Q1 2026 release — SEC 8-K](https://www.sec.gov/Archives/edgar/data/0001720635/000162828026029098/q12026nvtpressrelease.htm)
- [nVent Q1 2026 revenue +53% on AI demand — TIKR](https://www.tikr.com/blog/nvent-electric-q1-2026-earnings-revenue-surges-53-on-ai-data-center-demand)
- [Modine Q3 FY26 Climate Solutions +51%](https://www.sec.gov/Archives/edgar/data/0000067347/000110465926010338/mod-20260204xex99d1.htm)
- [Modine $4B hyperscaler chiller deal — Market Chameleon (May 26, 2026)](https://marketchameleon.com/articles/b/2026/5/26/modine-secures-4-billion-data-center-cooling-agreement-growth-outlook)
- [Supermicro liquid-cooled GB200 NVL72 SuperClusters — PR Newswire](https://www.prnewswire.com/news-releases/supermicros-liquid-cooled-superclusters-for-ai-data-centers-powered-by-nvidia-gb200-nvl72-and-nvidia-hgx-b200-systems-deliver-a-new-paradigm-of-energy-efficient-exascale-computing-302276685.html)
- [GB200 NVL72 deployment guide — Introl](https://introl.com/blog/gb200-nvl72-deployment-72-gpu-liquid-cooled)

---

## Power distribution + racks — Schneider, Eaton

## Current state (May 2026)

Electrical-equipment makers are the cleanest "picks-and-shovels" play on the AI buildout — backlogs at multi-year records, pricing power intact, and capacity expansion still 12–18 months from catching up. Medium-voltage gear and large transformers remain the slowest physical bottleneck in the entire AI capex chain.

**Eaton (ETN) — Q1 2026 (reported May 2026)**
- Revenue **$7.45B, +17% YoY**.
- **Data-center orders +240% YoY; data-center revenue +50% YoY.**
- **Total backlog $22.8B** (up from $19B exiting 2025). Electrical Americas backlog ~$10B — 4x the 2019 level.
- Electrical Americas Q4 25 sales grew to $3.5B (+21% YoY); record sales and profit for the segment.
- FY26 guide: organic growth ~7%, Electrical Americas +9–11%.
- **~$1.5B incremental capacity program** for transformers, switchgear, PD equipment. New plants in Mexico and Dominican Republic ramping; most online by mid-2025 but multi-year expansions complete late 2026 (with under-absorption / ramp costs heaviest Q4 25–Q1 26).
- Rolling 12-month orders +16%.

**Schneider Electric (SBGSF / SU.PA) — Q1 2026**
- Revenue **€9.77B, +11.2% organic** (+5.7% reported; FX a -6.7% / -€623M headwind in Q1; FY26 FX hit guided -€750M to -€850M).
- **Systems +16% organic; Data Center solutions inside Energy Management was the standout growth driver.**
- Energy Management €8B, +12.8% organic. Industrial Automation €2B.
- North America +14.4% organic; energy-management NA +15.9%. China & East Asia +14.2%.
- $140M US capacity expansion (custom switchgear + MV) announced 2024 still ramping.
- Acquired **Motivair** (DTC/CDU specialist) to round out the AI data-center power+cooling stack.
- €2.5–3.5B cumulative buyback authorized through 2030.
- Holds estimated mid-20s % share of the DC UPS market via APC brand.

**ABB (ABBNY) — Q1 2026**
- Revenue **$8.7B, +18% YoY / +11% comparable**. EPS $0.70 (+21%). FCF $1.3B (+92%).
- Electrification revenue **$4.6B, +21%**; comparable **electrification orders +44%**.
- Book-to-bill 1.29; **record backlog $27.5B (+22%)**.
- **Data-center electrification orders $2.4B in Q1 2026 alone — already exceeding all of FY25.**
- Announced NVIDIA partnership on **800V DC power architecture and 1 MW rack-scale** — positioning for Vera Rubin power requirements.
- FY26 growth + margin guidance raised. Margin pressured 290 bps in Q1 from FX/commodity hedges; Gamesa acquisition dilutive ~70 bps for FY26.

**Generac (GNRC) — Q1 2026**
- Revenue $1.06B, +12% YoY. Adj EPS $1.80 (vs. $1.33 consensus). Net income +65%.
- C&I revenue $510M, +28% YoY (incl. acquisitions/FX); **C&I expected +30% range for FY26** driven by hyperscaler data-center wins.
- In final stages of vendor approval with several hyperscalers; backlog expanding.
- FY26 guide raised. Stock +89% YTD 2026.
- Bought **Enercon** to vertically integrate megawatt backup; launched EcoGen HVO series Dec 2025 for European colos (Scope 1 reduction); April 2026 CPower partnership for PJM DER deployment.

**Cummins (CMI) — Q1 2026**
- Revenue $8.4B, +3%. NA -6%, international +16%.
- Net income $654M / $4.71 EPS (vs $824M / $5.96 prior).
- "Record performance in Power Systems" — strong demand for **data-center backup power** continued.
- FY26 guide: revenue +3–8%, EBITDA 17–18% of sales.
- **$150M Fridley MN expansion** (Feb 2026) to lift QSK95 high-horsepower output +30%; addresses 18-month lead times on big units.

**Hubbell (HUBB) — Q1 2026**
- Revenue **$1.517B, +11.1%**, +8.2% organic. Adj EPS $3.93 beat $3.87.
- Utility Solutions $948.9M (Grid Infra $727M, +18% YoY); Electrical Solutions $567.8M.
- "Strong data center and light-industrial markets" called out.
- Gross margin 33.3%; operating margin 17.4% (19.8% adj).
- FY26 outlook raised; shares fell 6% on valuation concerns despite beat.

**nVent (NVT)** — covered in D2 but also a power-management play (PDUs, cable management, white-space distribution). Q1 26 revenue +53% to $1.242B; backlog $2.6B; FY26 organic +21–23%.

**Switchgear / transformer lead times**
- Producer Price Index for switchgear up nearly 50% (2020–2024).
- HV switchgear and large transformers running **2–3 year lead times** — the slowest physical bottleneck in the AI buildout.
- Recent real-world projects: 4000 A services >1 year; 2.5 MW gensets >1.5 years.
- Eaton, Schneider, ABB capacity adds bring some relief by late 2026 but lead times not expected to return to pre-COVID norms.
- Europe has shorter lead times (denser local supply ecosystem); US is the tightest market.
- Tailwinds also from SF6-free MV switchgear transition (premium pricing on new tech).

## Key catalysts
- Eaton Electrical Americas plant ramps mid-to-late 2026 — first quarter of clean throughput could re-rate the stock.
- ABB 800V DC / 1 MW rack architecture w/ NVIDIA aligned with **Vera Rubin H2 2026 GA** — sets up FY27 product cycle.
- Schneider's Motivair integration (DTC) cross-sells into the AI EM-Systems book; H1 2026 results (Jul 30, 2026) will show traction.
- Generac hyperscaler vendor qualifications — converting one or more would unlock the next leg.
- Long-dated hyperscaler supply pacts (Modine's $4B template) likely to appear with at least one of Eaton/Schneider/ABB next.

## Risks
- Hyperscaler capex pause or backlog cancellation — biggest tail risk for all of them.
- Capacity additions could compress pricing into 2027 if demand normalizes.
- FX (esp. weak USD vs EUR) is a multi-hundred-million headwind for Schneider/ABB.
- Steel, copper, electrical-steel input volatility; transformer-grade GOES still tight.
- Geopolitical: tariffs and re-shoring requirements could swing competitive position.
- Some segments are dilutive even at growth co.'s — e.g., Eaton plant ramp under-absorption, ABB Gamesa, Schneider FX.
- Valuations rich: Eaton, Vertiv, nVent, Modine, Hubbell all trade at multi-year-high multiples; any guide cut is severely punished (Hubbell -6% after raising guide).

## Sources
- [Eaton Q4 2025 / FY26 outlook commentary — Electrical Trends](https://electricaltrends.com/2026/02/10/eaton-and-atkore-they-year-that-was-and-whats-next/)
- [Eaton end-to-end systems hyperscaler tender strategy](https://equityanalysiseng.substack.com/p/data-centers-power-crisis-meets-execution)
- [Eaton growth strategy and capacity expansion — PortersFiveForce](https://portersfiveforce.com/blogs/growth-strategy/eaton)
- [Switchgear, Cables, Gensets — quiet AI winners](https://medium.com/@_mh/switchgear-cables-and-gensets-the-quiet-winners-of-the-ai-data-center-boom-1c01bd41a67c)
- [Switchgear market price & supply challenges — GEP](https://www.gep.com/blog/mind/switchgear-market-price-supply-challenges)
- [Schneider Electric Q1 2026 revenues release (PDF)](https://www.se.com/ww/en/assets/pdf/release-q1-revenues-2026)
- [Schneider Q1 2026: 11% organic growth, AI strategy — Investing.com](https://www.investing.com/news/company-news/schneider-electric-q1-2026-slides-11-organic-growth-ai-strategy-advances-93CH-4647883)
- [Schneider Q1 2026 record revenue — IndexBox](https://www.indexbox.io/blog/schneider-electric-posts-record-quarterly-revenue-in-q1-2026-driven-by-data-center-demand/)
- [ABB Q1 2026 results — ABB news](https://new.abb.com/news/detail/135137/q1-2026-results)
- [ABB Q1 FY 2026 driven by data center & grid — Futurum](https://futurumgroup.com/insights/abb-q1-fy-2026-earnings-driven-by-data-center-and-grid-demand/)
- [Generac Q1 2026 8-K — SEC](https://www.sec.gov/Archives/edgar/data/0001474735/000143774926003700/ex_919348.htm)
- [Generac tops Q1, lifts 2026 outlook — Yahoo Finance](https://finance.yahoo.com/markets/stocks/articles/generac-tops-q1-earnings-estimates-144600016.html)
- [Cummins Q1 2026 8-K — SEC](https://www.sec.gov/Archives/edgar/data/0000026172/000002617226000013/cmi2026q18-kex99.htm)
- [Hubbell Q1 2026 8-K — SEC](https://www.sec.gov/Archives/edgar/data/0000048898/000162828026028600/exhibit991_04302026.htm)
- [Hubbell Q1 2026 raised outlook — Investing.com](https://www.investing.com/news/company-news/hubbell-q1-2026-slides-earnings-beat-raised-outlook-as-shares-fall-6-93CH-4650658)
- [AI Datacenter Power Investment Map — damnang2](https://damnang2.substack.com/p/ai-datacenter-power-investment-map)

---

## Nuclear SMRs — Oklo, NuScale, BWXT

## Current state (May 2026)

The SMR space has shifted from PowerPoint to construction in the last 12 months, with two distinct regulatory pathways emerging: the traditional NRC route (NuScale, X-energy) and the DOE Reactor Pilot Program authorization track (Oklo, TerraPower for components).

**Oklo (OKLO)** — Sam Altman-founded, NYSE-listed via 2024 SPAC, ~$1.4B cash at Q1 2026. Altman stepped down as chair in April 2025 to clear OpenAI offtake conflict. Oklo broke ground on its first 75 MWe Aurora powerhouse at Idaho National Laboratory in late 2025 using DOE Reactor Pilot Program authorization (not NRC). DOE approved Aurora's Nuclear Safety Design Agreement in March 2026. Management guides commercial operation late 2027/early 2028. NRC accepted Oklo's Principal Design Criteria report in 15 days (vs. typical 30–60). Atomic Alchemy subsidiary got its first NRC materials license in March 2026 for medical isotopes. **Headline customer deal**: Meta signed a 1.2 GW Oklo PPA for a Pike County, Ohio campus — pre-construction 2026, first power 2030, full capacity 2034. Also selected for an Eielson AFB microreactor. Net loss $33M in Q1 2026 on zero revenue; full-year burn $80–100M.

**NuScale (SMR)** — Still the only NRC-certified SMR vendor in the US. After UAMPS CFPP cancellation in November 2023 (cost crept toward $90/MWh), the company recovered by securing **NRC approval for its uprated 77 MWe US460 design** on May 29, 2025 (six modules = 462 MWe). Q1 2026 ended with $1B liquidity. Pivoted to hyperscalers (CEO mentions five "tier-one" hyperscaler discussions under NDA), Romania's RoPower (Doiceşti coal site, FID targeted Q1/Q2 2026), TVA, and US industrial partners Nucor and Fluor. Framatome supply chain partnership expanded. Deployment target: 2030.

**BWXT (BWXT)** — The pick-and-shovel SMR play. 2025 revenue $3.2B (+18%), backlog $7.3B (+50% YoY). 2026 guidance: non-GAAP EPS $4.55–4.70, adj. EBITDA $645–660M. Secured >$1.4B in Naval Nuclear Propulsion contracts in May 2026 ($1.29B long-lead + $165M Ford-class). $1.5B NNSA award (Sept 2025) for DUECE pilot domestic LEU/HEU enrichment plant. Project Pele 1.5 MW transportable microreactor on track for 2027 delivery — full TRISO fuel core delivered to INL. Designs steam generators for Rolls-Royce SMR; supplies GE Hitachi BWRX-300 and TerraPower components. Kinectrics acquisition drove Commercial Operations +122% in Q3 2025.

**X-energy** — IPO'd April 2026, raising ~$1.02B (shares +31% on debut). Amazon-backed; pipeline >11 GW. Flagship is the 4-unit, 800 MWth Long Mott Generating Station at Dow's Seadrift, TX site (NRC construction permit application filed March 2025, ~18 month review). Amazon's deployment is the separate Cascade Advanced Energy Facility in Washington with Energy Northwest — first 320 MW block via four Xe-100 units, expandable to 960 MW. Amazon has option for >5 GW of Xe-100 by 2039. Construction late decade, operations in the 2030s.

**TerraPower (Bill Gates)** — Won the first NRC commercial reactor construction permit in nearly a decade on March 4, 2026 (also first non-light-water commercial permit in 40+ years). Officially started construction April 23, 2026 at Kemmerer, WY. The 345 MWe sodium-cooled Natrium reactor has a molten salt storage system that can boost output to 500 MWe. Bechtel leading construction; ~1,600 construction jobs / 250 permanent. Target first power end of 2030. Meta agreement for up to 8 Natrium plants by 2035; second Utah site advancing. Original $4B price tag has risen substantially.

## Key catalysts

- Oklo first Aurora criticality at INL (late 2027 / early 2028) — gate for the entire DOE Pilot Program pathway
- Oklo NRC license submission targeting approval by 2027
- NuScale RoPower (Romania) FID — Q1/Q2 2026
- NuScale first firm US order from one of the five hyperscalers in NDA
- BWXT Project Pele delivery in 2027 — opens transportable microreactor TAM
- TerraPower Natrium operating license application post-construction permit
- X-energy Seadrift NRC permit decision (~Sept 2026)
- US DOE target: 10 reactors under construction by 2030; quadruple nuclear to ~400 GWe by 2050 (from ~97 GWe today)
- $800M DOE award to TVA and Holtec for new SMRs

## Risks

- **HALEU fuel bottleneck**: Oklo, X-energy, TerraPower all need HALEU. Centrus has delivered 900 kg; Russian imports end 2028. Real risk of fuel-constrained startup
- **Permit/operating license gap**: NuScale has design cert but no firm US order; Oklo's DOE pathway is novel and untested; TerraPower still needs separate operating license
- **Cost creep**: NuScale CFPP collapsed at $90/MWh. TerraPower has openly raised Kemmerer budget. Hyperscaler PPAs likely need $100+/MWh to justify
- **Timeline slippage**: "2028" claims are aggressive; 2030–2035 more realistic for utility-scale
- **Political/policy risk**: Trump admin Reactor Pilot Program supports Oklo today, but DOE could shift incentives; NRC commissioner turnover
- **Capital intensity**: All pre-revenue SMR pure-plays (Oklo, NuScale, X-energy) are burning $80M+/yr; equity issuance overhang

## Sources

- [Constellation plans 2028 restart of Three Mile Island unit 1, spurred by Microsoft PPA (Utility Dive)](https://www.utilitydive.com/news/constellation-three-mile-island-nuclear-power-plant-microsoft-data-center-ppa/727652/)
- [Oklo - Boost for Sam Altman-Backed Oklo as it Receives Key Environmental Permit (NucNet)](https://www.nucnet.org/news/boost-for-sam-altman-backed-oklo-as-it-receives-key-environmental-permit-11-5-2024)
- [Sam Altman to step down as chairman of SMR firm Oklo (DCD)](https://www.datacenterdynamics.com/en/news/sam-altman-to-step-down-as-chairman-of-smr-firm-oklo/)
- [NRC Approves NuScale's Uprated SMR Design (DOE)](https://www.energy.gov/ne/articles/nrc-approves-nuscale-powers-uprated-small-modular-reactor-design)
- [NuScale's 77-MWe SMR Clears NRC Review (POWER)](https://www.powermag.com/nuscales-77-mwe-smr-clears-nrc-review-sets-stage-for-first-firm-order/)
- [BWXT Q1 2026 results & Naval Nuclear contracts (StockTitan)](https://www.stocktitan.net/news/BWXT/)
- [TerraPower Commences Construction on America's First Utility-Scale Advanced Nuclear Power Plant](https://www.terrapower.com/TerraPower-Commences-Construction-on-Americas-First-Utility-Scale-Advanced-Nuclear-Power-Plant)
- [TerraPower's Kemmerer 1 Enters Construction (POWER)](https://www.powermag.com/terrapowers-kemmerer-1-enters-construction-timeline-of-the-natrium-projects-road-to-first-power/)
- [Amazon Unveils 'Cascade' — Energy Northwest's Xe-100 SMR Project (POWER)](https://www.powermag.com/amazon-unveils-cascade-energy-northwests-xe-100-smr-project-targeting-construction-by-2030/)
- [X-energy raises $1.02B in record nuclear IPO (TNW)](https://thenextweb.com/news/x-energy-ipo-billion-nuclear-ai-data-centres)
- [Dow, Amazon take chance on nuclear company X-energy (Trellis)](https://trellis.net/article/dow-amazon-take-chance-nuclear/)

---

## Uranium — Cameco, NXE, miners

## Current state (May 2026)

Uranium broke back above $100/lb in early 2026 after a tepid 2025 that was actually punished by Kazatomprom's surprise 10% production cut. The structural deficit is widening: reactor demand expected to double by 2040, supply additions have been slow, and the U.S. Russian-import ban takes full effect 2028. Sprott SRUUF traded ~$20.54 in May 2026 (52-week range $15.01–$24.77). Uranium was added to the US Critical Minerals list in 2025 — a meaningful policy shift after decades of USGS dismissing supply concerns.

**Cameco (CCJ)** — Production guidance 19.5–21.5 Mlbs (Cameco share) for 2026; fuel services 13–14M kgU. Contract book averages ~28 Mlbs/yr through 2030. **Headline 2026 deal**: 9-year, ~22 Mlbs supply agreement with India's Department of Atomic Energy at market-related pricing, total value ~$2.6B (signed March 2, 2026). Westinghouse contribution accelerating — full-year 2025 net earnings +$418M YoY, adj. EBITDA +$398M to $1.9B, partly driven by Dukovany (Czech) construction participation. Westinghouse cash distributions: $171.5M (Cameco share) in October 2025 + $49M early 2026. $1.1B cash, $1.0B debt, $1.0B undrawn revolver at Q1 2026. Strategic US government partnership to accelerate US reactor construction announced.

**Kazatomprom (KAP / KZAP)** — World's largest producer, ~24–32% of global mined supply. 2026 guidance: 27,500–29,000 tU on 100% basis (71.5–75.4 Mlbs), +9% YoY but **5% below state-granted licensed level** (29,697 tU). KAP attributable 2026 production: 14,500–15,500 tU. Sales 19,500–20,500 tU. Major supply caveat: Budenovskoye JV 2024–2026 output is 100% committed to Russian civil nuclear under offtake. Sulphuric acid availability remains the operational swing factor. ~$22.7B market cap.

**NexGen Energy (NXE)** — Rook I / Arrow project received final CNSC federal approval March 5, 2026 — first large-scale Canadian uranium permit in 20+ years. **Final Investment Decision** made; construction starts summer 2026, 4-year build. At capacity: up to **30 Mlbs/yr** — would be >20% of global supply, 50%+ of Western world supply, surpassing Cameco. Stock +102% over past year, +34% YTD. Patterson Corridor East exploration adding to resource (45,500m 2026 program).

**Uranium Energy (UEC)** — Now actively producing. Burke Hollow (Texas ISR) came online April 2026 — first new US ISR mine in over a decade. Christensen Ranch (Wyoming) expansion approved. Two operating hub-and-spoke ISR platforms; Hobson Central Processing Plant licensed up to 4 Mlbs/yr. Ludeman ISR project targeted for 2027 startup. Positioned as the largest US uranium supplier with the largest US resource base.

**Denison Mines (DNN)** — Phoenix ISR project: CNSC license to construct issued Feb 19, 2026; Board FID Feb 24, 2026. Site prep began March 2026, full execution ramp by Q2 2026 end. Initial capex ~$600M. Resource: 70.5 Mlbs at 11.4% grade (exceptional). ~8 Mlbs in uranium sales commitments. First production target mid-2028.

**Enrichment — the under-appreciated bottleneck:**

- **Centrus (LEU)**: Only NRC-approved HALEU producer in US. DOE contract extended to June 30, 2026 with options through 2034. Phase II completed with 900 kg HALEU delivered. **$900M DOE task order in January 2026** to expand Piketon, OH facility. Part of broader $2.7B DOE HALEU strategy. LEU sales backlog: $2.3B. Piketon expansion: 1,000 construction jobs + 300 ops. October 2024 — Centrus, Urenco USA, Orano USA, General Matter all won HALEU production contracts.
- **URENCO USA**: One of two NRC-approved LEU producers (with Centrus). Also won October 2024 HALEU contract.

## Key catalysts

- Russian uranium import ban full effect — 2028
- Strategic uranium reserve discussions (price floor or equity-for-offtake)
- NexGen Rook I construction start (summer 2026) → adds 30 Mlbs/yr at end-2030
- Cameco / Westinghouse — additional reactor procurement deals from US gov partnership
- Kazatomprom Q3 quarterly updates — any further downflex announcement could push spot through $110/lb
- DOE additional HALEU task orders to Centrus / Urenco / Orano / General Matter
- DOE $800M TVA + Holtec SMR award — incremental fuel demand

## Risks

- **Term market lag**: Spot is up but utilities are under-contracted; if utilities don't show up to term, equity rally could fade (Sprott's 2025 caution still relevant)
- **Kazakh geopolitical**: Budenovskoye JV is Russian-tied; sanctions creep or sulphuric acid disruption
- **Construction execution**: NXE 4-year build is aggressive; cost overruns at Rook I would crowd out junior valuations
- **DNN capex**: $600M Phoenix budget could grow given industry-wide cost inflation
- **HALEU mismatch**: Supply ramps from Centrus are slow vs. demand from SMRs starting up 2027–2030
- **Equity supply**: Junior miners (UEC, DNN, NXE) routinely raise equity; secondary offerings cap rallies

## Sources

- [Sprott Uranium Outlook 2026](https://sprott.com/insights/uranium-outlook-2026/)
- [Cameco Q1 2026 results (StockTitan)](https://www.stocktitan.net/sec-filings/CCJ/6-k-cameco-corp-current-report-foreign-issuer-62bdb4722cad.html)
- [Kazatomprom 2026 Production Guidance (IndexBox)](https://www.indexbox.io/blog/kazatomprom-forecasts-9-uranium-output-increase-for-2026/)
- [Kazatomprom Cuts Nominal Output By 5% of World's Supply (The Deep Dive)](https://thedeepdive.ca/kazatomprom-cuts-nominal-output-by-5-of-worlds-supply/)
- [NexGen wins final approval for Rook I uranium mine (StockTitan)](https://www.stocktitan.net/news/NXE/nex-gen-receives-final-federal-approval-for-the-rook-i-uranium-c1vp232p16r5.html)
- [NexGen Energy Jumps 102% as Tech Giants Seek Uranium (NAI 500)](https://nai500.com/blog/2026/02/nexgen-energy-jumps-102-as-tech-giants-seek-uranium/)
- [Uranium Energy Corp Burke Hollow startup (SEC 8-K)](https://www.sec.gov/Archives/edgar/data/1334933/000143774926011769/ex_943033.htm)
- [Denison Mines Phoenix FID & construction (Denison release)](https://denisonmines.com/news/denison-reports-readiness-to-commence-construction-122840/)
- [Centrus Completes 900-kg HALEU Delivery (POWER)](https://www.powermag.com/centrus-completes-900-kg-haleu-delivery-to-doe-in-u-s-nuclear-fuel-enrichment-milestone/)
- [Centrus DOE contract extension (Centrus IR)](https://www.centrusenergy.com/news/centrus-energy-secures-contract-extension-from-department-of-energy-to-continue-haleu-production/)

---

## Natural gas peakers + LNG

## Current state (May 2026)

Gas turbines have become the rate-limiting hardware for AI data centers. The Big Three OEMs — GE Vernova, Siemens Energy, Mitsubishi Heavy — collectively control ~two-thirds of large gas turbine capacity, all booked solid 5+ years out. Lead times: 5–7 years for new heavy-duty turbines; turbine prices up ~195% per Wood Mackenzie. Wood Mackenzie forecasts data center electricity consumption +96% between 2026 and 2031. ~63 GW of US gas capacity additions planned 2026–2030; orders expected to peak in 2026.

**GE Vernova (GEV)** — Q1 2026: orders $18.3B (+71% organic), revenue $9.3B (+16%), adj. EBITDA $0.9B (margin 9.6%, +390 bps). Gas Power backlog and slot reservations grew from 83 → **100 GW** in Q1; targeting ≥110 GW by YE 2026. Total backlog $163B (vs. $116B at April 2024 spinoff); Strazik pulled forward $200B backlog target from 2028 → 2027. 25 gas turbines delivered in Q1 (+32% YoY); pricing on new bidding up **10–20%** vs. Q4 prior. Capacity expansion >$160M to lift output from ~50 to 70–80 large-frame turbines/yr by late 2026. Net income $4.7B (includes $4.5B Prolec GE M&A gain). Raised 2026 guidance: revenue $44.5–45.5B, adj. EBITDA margin 12–14%. Q1 Electrification segment booked $2.4B in data center orders — more than all of 2024. Stock crossed $1,180; market cap >$300B. UBS / Baird PTs to $1,400.

**Siemens Energy** — 2025 gas turbine units sold nearly doubled to 194 (from 100 in 2024). Total order book record €136B. **~60% of 2025 gas turbine orders tied to data centers** per FT. CEO Bruch flagged "unprecedented" data center driven demand. Key 2026 project: Trumbull Energy Center, OH (950 MW). $1B US investment program; 24/7 ops at key facilities. ~$91B market cap.

**Mitsubishi Heavy** — H1 FY25 large-frame orders: 23 units (+14 YoY), majority NA/Asia. CEO Eisaku Ito: "working toward 30% capacity boost — not enough," now planning to **double** manufacturing capacity by 2028. 10-year US large gas turbine forecast nearly doubled in 1 year. Key 2026 project: Bison Generation Station, ND (1.49 GW) — Mitsubishi turbines + Toshiba steam in the heart of the Bakken. ~$84B market cap.

**Permian / Texas behind-the-meter**:

- **Energy Transfer (ET)**: 3 data center / power deals signed in TX, 2 more close to FID. CloudBurst 10-year deal for up to 0.45 Bcf/d. Separate BTM hyperscaler contract upsized ~5x to 0.38 Bcf/d. **Desert Southwest Pipeline FID** — $5.3B / 1.5 Bcf/d Permian → Arizona/SW
- **New ERA Energy & Digital / Texas Critical Data Centers**: 438-acre Ector County campus, >1 GW potential compute, power delivery as early as end-2027
- **CalEthos / TerraVolt** (May 2026): 55,000 MMBTU/day firm gas supply for BTM onsite power plant
- **Vistra Permian Basin**: 860 MW gas units under construction, tripling existing capacity

**Pipelines**:

- **Williams (WMB)**: Transports ~33% of US gas. $1.6B agreement for on-site gas + power for an unnamed IG client, completion late 2026 with 10-year fixed-price PPA. Rocky Mountain expansion + Louisiana Energy Gateway (Haynesville → S. Louisiana)
- **Kinder Morgan (KMI)**: Project backlog raised to $10B in Q4 2025, ~60% tied to power demand, much of that data centers. Footprint advantages in TX/AZ/SC. Acquired Monument Pipeline ($505M, April 2026) for Houston area. Trident Pipeline ($1.7B with Golden Pass LNG / Entergy Texas)

**LNG vs. data center demand**: RBN's Rusty Braziel calculates new LNG capacity will demand **~3x as much gas as new data center power plants** through 2030. East Daley: US gas demand ~120.7 Bcf/d by end-2026, driven by +3.7 Bcf/d LNG feed gas (Plaquemines, Corpus Christi Stage 3, Golden Pass) and ~0.5 Bcf/d power demand. Bottom line: LNG is the heavyweight on demand; data centers are additive.

## Key catalysts

- GEV reaching $200B backlog (now pulled forward to 2027)
- 2026 turbine order vintage (expected peak year for AI-driven orders)
- OEM capacity expansion: GEV (70–80/yr by late 2026), MHI (doubling by 2028), Siemens (24/7 ops)
- Plaquemines / Corpus Christi Stage 3 / Golden Pass LNG ramps
- Desert Southwest Pipeline construction (Permian → AZ)
- More BTM gas-for-data-center deals (Williams, ET pattern)

## Risks

- **Methane / PR risk**: Hyperscalers have Net Zero commitments; gas-heavy ramps clash with carbon-neutral marketing. Microsoft, Google, Meta all face scope 2/3 reporting pressure
- **Slot reservation discipline**: GEV's 17 GW of slot reservations are not firm orders; cancellation if AI capex moderates
- **Permian gas infrastructure constraint**: Waha hub volatility, takeaway capacity, produced water handling are real bottlenecks
- **Tariffs / trade**: Steel for turbines and pipelines sensitive to tariff cycles
- **LNG cannibalization**: If LNG export economics stay strong, gas could leave the system before reaching power plants — domestic prices rise, BTM economics worsen
- **Wind drag at GEV**: Wind segment EBIT loss ~$400M/yr drags consolidated margin

## Sources

- [GE Vernova Q1 2026 earnings (SEC 8-K)](https://www.sec.gov/Archives/edgar/data/0001996810/000199681026000063/gevpressrelease1q26.htm)
- [GE Vernova gas turbine backlog hits 100 GW (Utility Dive)](https://www.utilitydive.com/news/ge-vernova-gas-turbine-backlog-hits-100-gw-as-prices-rise/818332/)
- [Massive gas turbine demand powers up Siemens (ASM)](https://www.asminternational.org/massive-gas-turbine-demand-powers-up-siemens-other-providers/)
- [Gas turbine prices soar 195% (Wood Mackenzie)](https://www.woodmac.com/press-releases/gas-turbine-prices-soar-195-as-market-faces-supply-demand-crisis/)
- [Siemens Energy, Mitsubishi Struggle to Keep Up With AI-Driven Demand (Bloomberg)](https://www.bloomberg.com/features/2025-bottlenecks-gas-turbines/)
- [Williams vs Kinder Morgan: Data Center Energy Race (AINvest)](https://www.ainvest.com/news/williams-companies-kinder-morgan-winning-data-center-energy-race-2509/)
- [LNG exports vs. data centers (BIC Magazine)](https://www.bicmagazine.com/industry/natgas-lng/lng-exports-data-centers-natural-gas/)
- [Data Centers 'Playing Second Fiddle' to LNG (NGI)](https://naturalgasintel.com/news/data-centers-playing-second-fiddle-to-lng-as-haynesville-permian-ramp-up-natural-gas-supply/)
- [The Emerging Nexus of Data Centers, Excess Natural Gas (Mercer Capital)](https://mercercapital.com/insights/blogs/energy-valuation-insights-blog/2026/the-emerging-nexus-of-data-centers-excess-natural-gas-and-produced-water-part-i/)

---

## Grid + transformers — GE Vernova, Hitachi Energy

## Current state (May 2026)

The grid is the under-appreciated bottleneck. Transformer lead times have stretched to **115–144 weeks** (28–36 months) for standard power transformers; **up to 40 months** for large units at Hitachi Energy; **up to 4 years** for specialized orders. Generator step-up transformer demand +274% since 2019; substation power transformers +116%. BloombergNEF expects global grid spending to exceed **$500B in 2026**. Wood Mackenzie models a 30% large-power-transformer shortfall and 10% distribution shortfall through 2025. Roughly **80% of large US transformers are imported** (Mexico, South Korea), and the only US grain-oriented electrical steel producer is Cleveland-Cliffs — single point of failure.

**Hitachi Energy** (private subsidiary of Hitachi Ltd, ABB acquired the legacy grid business in 2020). Investing **$6B in capacity expansion by 2027**, ~2x prior 3-year spend; >$9B total committed to address global shortages including $1.5B specifically for transformers. New US plant: South Boston, VA ($457M, to be largest US large-power-transformer plant by 2028) + $106M expansion in Alamo, TN. Also expanding Bad Honnef (Germany), Ludvika (Sweden), Finland and Spain plants. CEO Schierenbeck projects global market for its products to reach $350B by 2030 ("Electricity Era"). HVDC Light technology used in SunZia 525 kV / 550 mile / 3,000 MW NM→AZ HVDC link — the largest VSC HVDC installation in the US.

**GE Vernova Electrification segment** — Backlog growing alongside Gas Power. Q1 2026: $2.4B data center equipment orders booked — more than all of 2024. Total GEV backlog $163B and pulling forward $200B backlog target to 2027. Prolec GE consolidation (transformers) generated $4.5B M&A gain in Q1 2026.

**ABB (ABBN)** — Q1 FY26 revenue $8.7B (+18%), Electrification revenue $4.6B (+21%). **Electrification orders +44% comparable, with triple-digit growth in data center orders**. VoltaGrid partnership extended March 2026 at CERAWeek — ABB supplying 35 synchronous condensers with flywheels and prefab eHouse units for hyperscale AI data center microgrids. Strength in medium-voltage UPS.

**Schneider Electric (SU.PA)** — Q1 2026 record revenue $11.4B (+11.2% organic). Energy Management segment +~13%. CFO Maxson: data center orders accelerated late 2025, strong through 2026. Strategy: liquid cooling (Motivair acquisition), 800V DC architectures, NVIDIA + ETAP digital twin partnership, EcoStruxure / AVEVA software, Movitair. Sustainability ambition: save/electrify 1,500 TWh of customer energy 2026–2030 (≈ 1/3 of US 2025 electricity).

**Quanta Services (PWR)** — Pure-play grid construction. Backlog $39.2B at Q3 2025 → $48.5B more recently; Electric segment backlog $36.2B. 2026 guidance: revenue $33.25–33.75B, adj. EPS $12.65–13.35. Consensus 2026 EPS $13.95 (+29.8% YoY); 2027 $16.39 (+17.5%). Workforce 60,000+ — self-perform model is a major moat in tight labor market. Permitting reform on interstate transmission starting to ease project lead times in early 2026.

**MasTec (MTZ)** — 2025 record revenue $14.3B (+16%); 18-month backlog $19.0B (+33% YoY). Q1 2026 backlog record **$20.3B** (+7% QoQ, +28% YoY), 1.4x book-to-bill. Nearly $1B of data center-related work in backlog. 2026 guidance raised: revenue ~$17.5B, adj. EBITDA $1.5B, EPS $8.79. Consensus 2026 EPS $8.86 (+35.3%); 2027 $11.77 (+32.8%).

**HVDC projects in play**:

- **SunZia** (Pattern Energy / Hitachi Energy HVDC Light): 100% pad grading complete, 73% structures assembled, 67% erected; cable stringing ongoing. **Commercial operations 2026.** $20B lifetime revenue. Pending Arizona litigation re BLM authorization
- **Grain Belt Express** (Invenergy): $11B, 800-mile, 600 kV HVDC, 5,000 MW, KS→MO→IL→IN. Construction 2026, operational 2029. Siemens Energy supplying HVDC converter stations (KS, MO). Quanta + Kiewit major contractors. DOE conditional loan guarantee cancelled in 2025 but developer says project moving forward
- **Champlain Hudson Power Express**: Canadian hydro → NYC, 300+ mi underground/underwater, energization 2026
- **New England Clean Energy Connect**: Canadian hydro → MA via ME, delivering electricity

## Key catalysts

- Hitachi Energy South Boston, VA transformer plant — largest in US by 2028
- SunZia commercial operations (2026) — first major VSC HVDC in US
- Grain Belt Express construction start 2026 → 2029 operations
- Cleveland-Cliffs grain-oriented electrical steel capacity any expansion
- Permitting reform follow-through (interstate transmission)
- Q2 2026 PJM transmission planning revisions

## Risks

- **Transformer lead times structural**: Even with $6B Hitachi Energy spend, Schierenbeck conceded "probably not enough" — supply tight through late 2020s
- **Single-source US electrical steel**: Cleveland-Cliffs is sole US grain-oriented producer; any operational disruption ripples
- **Skilled engineering shortage**: Training transformer engineers is multi-year — Hitachi flags this explicitly as the binding capacity constraint
- **Project siting / litigation**: SunZia 17-year permitting saga, ongoing San Pedro Valley litigation (Tucson court ruling pending on summary judgment motion filed March 13, 2026); HVDC siting is politically fragile
- **Federal loan cancellations**: DOE Loan Programs Office posture has changed under Trump — Grain Belt and Joint Targeted Interconnection Queue both had funding cancelled; new projects can't rely on DOE LPO
- **Labor scarcity tailwind = moat or ceiling**: For Quanta/MasTec it's a moat, but it also caps how much grid we can actually build
- **Stranded asset risk**: Renewables projects without transformers risk being mothballed
- **Imports / tariffs**: 80% of large transformers imported; trade frictions = price spikes

## Sources

- [Hitachi Energy CEO warns of transformer supply shortage (DCD)](https://www.datacenterdynamics.com/en/news/hitachi-energy-ceo-warns-of-transformer-supply-shortage/)
- [US transformer market faces severe supply constraints (pv magazine USA)](https://pv-magazine-usa.com/2026/05/11/u-s-transformer-market-faces-severe-supply-constraints-as-lead-times-extend-to-four-years/)
- [Transformers in 2026: Shortage, Scramble, or Self-Inflicted Crisis? (POWER)](https://www.powermag.com/transformers-in-2026-shortage-scramble-or-self-inflicted-crisis/)
- [America's Transformer Shortage: Hitachi Energy Investment (Mirror Review)](https://www.mirrorreview.com/news/hitachi-energy-investment-transformer-shortage/)
- [Quanta Services PWR 2026 Deep Dive (Financial Content)](https://markets.financialcontent.com/stocks/article/finterra-2026-1-22-the-architect-of-electrification-a-deep-dive-into-quanta-services-pwr-in-2026)
- [Quanta vs MasTec: Better AI Infrastructure Stock (Yahoo Finance)](https://finance.yahoo.com/markets/stocks/articles/quanta-vs-mastec-ai-infrastructure-145000521.html)
- [MasTec Q1 2026 record backlog (SEC 8-K)](https://www.sec.gov/Archives/edgar/data/0000015615/000001561526000018/mtz1231258-kex991.htm)
- [ABB Q1 FY 2026 Earnings (Futurum)](https://futurumgroup.com/insights/abb-q1-fy-2026-earnings-driven-by-data-center-and-grid-demand/)
- [Schneider Electric Q1 2026 Revenue (Construction Owners)](https://www.constructionowners.com/news/schneider-electric-sees-surge-in-revenue-as-energy-security-ai-drive-data-center-demand)
- [$11B Grain Belt Express HVDC Slated for 2026 Construction (ConstructConnect)](https://news.constructconnect.com/11b-grain-belt-express-transmission-line-slated-for-construction-in-2026)
- [SunZia HVDC Project Status (BlackRidge Research)](https://www.blackridgeresearch.com/project-profiles/sunzia-wind-farm-transmission-project-status-location-cost-contractors-details-united-states-us)

---

## Switching silicon — Broadcom, Marvell

## Current state (May 2026)

Broadcom (AVGO) has become the second-most important AI semiconductor franchise in the world, behind only Nvidia, on the strength of two distinct businesses: merchant Ethernet switching silicon (Tomahawk / Jericho) and custom XPU design services for hyperscalers.

**Tomahawk / Jericho deployment timing.** Broadcom announced on March 12, 2026 that the Tomahawk 6 family (102.4 Tbps, 3nm) is now shipping in **production volume**, going from initial sampling (June 2025) to volume in less than three quarters — extraordinarily fast for a chip of this scale. The CPO variant, branded **Tomahawk 6 — Davisson**, is the industry's first 102.4 Tbps Ethernet switch with co-packaged optics, manufactured using TSMC's COUPE process. TH6 supports 100G/200G SerDes (up to 1024×100G or 512×200G), Cognitive Routing 2.0, and is designed for 100K+ XPU clusters scaling toward 1M-XPU fabrics. Tomahawk 5 (51.2 Tbps) remains the workhorse in front-end Ethernet AI fabrics. **Jericho3-AI** continues to anchor the deep-buffer, scheduled-fabric category for back-end AI training (Meta in particular).

**AI revenue trajectory.** AVGO reported **Q1 FY2026 AI semiconductor revenue of $8.4B (+106% YoY)** — above guide — and guided **Q2 FY2026 AI revenue to ~$10.7B (+140% YoY)**, on total Q2 revenue of ~$22B (+47%). CEO Hock Tan has explicitly stated AVGO has "line of sight" to **>$100B in AI chip revenue in 2027**, backed by a ~$73B committed-order backlog.

**Custom XPU customers (confirmed/identified).**
- **Google TPU** — 7th-gen TPU referenced for FY26; multi-generation roadmap into FY27+. Longest-standing partner (since 2014).
- **Meta MTIA** — On April 14, 2026 AVGO and Meta announced an extended partnership through 2029. Meta committed to >1 GW of custom MTIA silicon in an initial phase with a "multi-gigawatt" rollout to follow; AVGO calls it the "industry's first 2nm AI compute accelerator." Hock Tan simultaneously announced he will not stand for reelection to Meta's board and will move to an advisor role on Meta's silicon roadmap.
- **OpenAI** — first custom ASIC slipped from Q2 2026 to Q3 2026 at earliest; $10B program, TSMC fab.
- **Anthropic** — ~1 GW of TPU-class capacity in 2026 scaling to 3 GW in 2027 (via Google TPU program).
- AVGO has confirmed **six major XPU customers** in total.

**Marvell (MRVL) — the credible #2.** Q1 FY2026 revenue was **$1.895B (+41% YoY)**; data-center revenue $1.44B (+76% YoY); EPS $0.62 (+158%). Guided Q2 to $2.0B (+57%). Custom silicon programs:
- **Amazon Trainium** — 5-year supply agreement signed late 2024 covers Trainium2 ramp; visibility through Trainium3 in 2026. However, **Trainium3 design was reportedly lost to Alchip** (monolithic die approach preferred over Marvell's chiplet proposal), a meaningful overhang.
- **Microsoft Maia** — Marvell supplies silicon IP and back-end design services for Azure/OpenAI inference accelerators.
- **Alphabet** — Marvell secured a portion of next-generation TPU work, breaking AVGO's perceived TPU monopoly and validating hyperscaler multi-sourcing.
- **Nvidia** — multi-billion-dollar position reported, tied to co-development of NVLink-compatible interconnect and optical DSPs.
- 20+ custom AI design wins targeted for FY28/FY29 production.

Stock has roughly doubled YTD in 2026 (~+100%) heading into the May 2026 print.

**Switch chip TAM growth.** McKinsey/TrendForce trajectories point to merchant Ethernet AI switch silicon scaling toward the tens of billions by 2027, with 102.4T-class chips (TH6, Cisco G300, Nvidia Spectrum-6) becoming the standard SKU for new AI factory builds in 2026-2027. Dell'Oro projects Ethernet surpasses InfiniBand in AI back-end share by 2027.

## Key catalysts

- **AVGO Q2 FY2026 print (June 2026)** — actuals vs. $10.7B AI guide; updated FY26 AI revenue commentary; OpenAI program timing.
- **Tomahawk 6 Davisson (CPO) volume ramp** — H1/H2 2026 hyperscaler deployments (Edgecore systems, Nexthop AI).
- **Meta MTIA 2nm ramp** — first multi-GW deployments target 2027; design milestones in 2026.
- **Anthropic 1→3 GW TPU scale-up** through Google/Broadcom in 2026-2027.
- **OpenAI custom chip tape-out / first silicon** — slipped to Q3 2026.
- **MRVL** — Trainium3 follow-on programs, NVLink Fusion interconnect tape-outs, Google TPU share allocation.
- Tomahawk Ultra (scale-up Ethernet) traction as an alternative to NVLink in non-Nvidia racks.

## Risks

- **Customer concentration.** AVGO AI mix is dominated by Google + Meta; MRVL is dominated by Amazon + Microsoft. Any single hyperscaler capex pause or design pivot is material.
- **Design loss precedent.** Marvell's Trainium3 chiplet loss to Alchip shows that hyperscaler ASIC sockets are not annuities; Alchip/MediaTek/GUC are credible second-sourcing threats.
- **Hock Tan succession** — Tan moving toward advisor roles signals eventual transition; CEO continuity is core to the AVGO bull case.
- **Nvidia counter-attack.** Spectrum-6 / Spectrum-X CPO at 102.4 Tbps lands H2 2026; AVGO loses share if hyperscalers consolidate on Nvidia full-stack.
- **CPO ecosystem risk** — optical engine yields, fiber-attach reliability, and field-serviceability are unproven at scale. If CPO disappoints, pluggable transceiver vendors (and TH6 non-CPO) benefit.
- **Backlog quality.** $73B figure includes multi-year, non-cancelable but extendable commitments; pull-ins are not guaranteed.
- **China demand and export controls** continue to add binary tail risk to the AI silicon TAM.

## Sources
- [Broadcom Now Shipping World's First 102.4 Tbps Switch in Production Volume](https://www.globenewswire.com/news-release/2026/03/12/3255072/0/en/Broadcom-Now-Shipping-World-s-First-102-4-Tbps-Switch-in-Production-Volume.html)
- [Broadcom Announces Tomahawk 6 – Davisson, Industry's First 102.4-Tbps Ethernet Switch with CPO](https://investors.broadcom.com/news-releases/news-release-details/broadcom-announces-tomahawkr-6-davisson-industrys-first-1024)
- [Broadcom Q1 FY 2026 Earnings Driven by XPU Momentum — Futurum](https://futurumgroup.com/insights/broadcom-q1-fy-2026-earnings-driven-by-xpu-momentum/)
- [Broadcom Q1 FY2026: $8.4B AI Revenue, Up 106% YoY](https://finovian.com/category/earnings/broadcom-q1-fy2026-earnings-analysis/)
- [Meta-Broadcom MTIA Deal: 1GW of 2nm Custom AI Silicon](https://nerdleveltech.com/meta-broadcom-mtia-deal-1gw-custom-ai-silicon)
- [Custom AI ASIC state of play (May 2026) — Tom's Hardware](https://www.tomshardware.com/tech-industry/semiconductors/custom-ai-asics-examined-from-broadcom-to-mtia)
- [Marvell Q1 FY2026 Results — Futurum](https://futurumgroup.com/insights/marvell-q1-fy-2026-results-driven-by-custom-silicon-and-data-center-momentum/)
- [Marvell Technology (MRVL): The Custom AI Silicon Story Beyond NVDA and AVGO](https://www.heygotrade.com/en/blog/marvell-mrvl-custom-ai-silicon-beyond-nvidia-broadcom/)
- [Amazon Just Shared Great News for This AI Chipmaker (MRVL) — Motley Fool](https://www.fool.com/investing/2026/02/19/amazon-great-news-ai-chipmakeker-nvda-mrvl/)
- [ServeTheHome — Tomahawk 6 102.4T Switch Chips & Tomahawk Ultra](https://www.servethehome.com/the-massive-size-of-broadcom-tomahawk-6-102-4t-switch-chips-and-tomahawk-ultra-bonus/)

---

## Optical interconnect — Coherent, Lumentum, Astera

## Current state (May 2026)

Optical interconnect has emerged as one of the most supply-constrained, structurally-rationed segments of the AI buildout, with multi-year demand outstripping supply by 2x in the key 800G/1.6T transceiver category.

**Volume picture.** TrendForce: 800G-and-above transceiver shipments scale from **24M units (2025) → ~63M units (2026)**, a 2.6x jump in one year. Global AI optical transceiver market is projected at **~$26B in 2026**. McKinsey's mid-2025 work flagged 800G running **40-60% short of demand through 2027** and 1.6T 30-40% short through 2029, with the bottleneck rooted in InP/EML laser fab.

**Lumentum (LITE)** is the indispensable laser supplier. LITE is the only firm shipping **200G-per-lane EMLs** in volume (the laser inside next-gen 1.6T), with claimed 50-60% global share of high-end EMLs and demand running 25-30% above supply even after a ~40% capacity expansion. Q2 FY26 guide: **$630-670M revenue** (>20% sequential), 20-22% non-GAAP op margin, EPS $1.30-1.50 — pulling forward the prior $600M/Q target by ~6 months.

**Coherent (COHR)** plays the vertically-integrated transceiver module game. Stock ~+85% YTD on 1.6T ramp and divestitures of non-core assets. Coherent's **6-inch InP wafer line in Sherman, TX** (ramped late 2025) is a structural cost advantage over LITE's older 4-inch line. Sells modules direct to Google/Meta/Microsoft, capturing more revenue per connection than chip-only vendors.

**Nvidia's $4B optics bet (March 2, 2026)** — split $2B/$2B between Coherent and Lumentum, tied to multi-year purchase commitments and priority access to capacity. The Coherent 8-K disclosed expanded access to "five additional product families" for co-packaged optics. The transaction explicitly signals Nvidia views photonics as a structural gating factor, akin to the H100-era CoWoS bottleneck.

**Fabrinet (FN)** — contract manufacturer to Nvidia and others. Q3 FY26 (reported May 4, 2026): **$1.21B revenue (+541% YoY base effects)**; optical comms $888.7M (73% of mix), with Datacom $260M and DCI $197M. HPC line (Nvidia-associated) more than doubled YoY to ~$107M. Management clarified on the call that the two new hyperscale datacom programs are **both 800G** (scale-out), not 1.6T — the stock fell ~13% on the disappointment that 1.6T hadn't yet ramped.

**Astera Labs (ALAB)** is increasingly the third leg of the optical/interconnect bull case despite shipping primarily electrical product today. Q1 FY26 (May 5, 2026): **$308.4M revenue (+93% YoY)**, non-GAAP gross margin 76.4%, non-GAAP op margin 36.2%, EPS $0.61. Q2 guide: **$355-365M**, EPS $0.68-0.70. PCIe Gen 6 (Aries retimers) crossed 1/3 of total revenue. **Scorpio Smart Fabric Switch** — including the X-Series 320-lane scale-up fabric switch — entered initial shipments in Q1 with production volumes ramping H2 FY26; management expects Scorpio to be the **largest product line by year-end FY26** (vs ~15% in FY25). Portfolio spans PCIe/CXL retimers (Aries), CXL memory controllers (Leo), Ethernet smart cable modules (Taurus), scale-up Scorpio fabric, and custom NVLink Fusion connectivity. Roadmap: NPO-style optics in FY27, mainstream **CPO around FY28**; UALink revenue starts 2027.

**Marvell optical product** — at OFC 2026 showcased 400G/lane PAM (a step toward 3.2T interconnects), 1.6T linear-drive pluggables on its silicon photonics light engine, production 1.6T AEC DSPs, coherent DSPs for 20km campus DCI, and PCIe Gen 6/7 SerDes. Optical DSPs remain a multi-hundred-million quarterly revenue line and a fast-growing portion of MRVL's data-center segment.

**MACOM, AAOI, POET** and Taiwanese (Elite Advanced Laser, LuxNet) and Japanese suppliers are all expanding 800G/1.6T module capacity (up to ~35K modules/month at single sites) but cannot relieve the InP epi bottleneck near-term.

**CPO timeline (industry).** CPO penetration moves from ~0 in 2025 to **>35% of switch ports by 2030** (TrendForce). Near-term, the first CPO production deployments in 2026 are Broadcom Tomahawk 6 Davisson and Nvidia Quantum-X (InfiniBand, early 2026) and Spectrum-X Photonics (Ethernet, H2 2026) — see W3 for fabric context. Bandwidth target: 102.4 Tbps per ASIC initially, scaling to Nvidia's 4-ASIC 409.6 Tbps configuration.

## Key catalysts

- **Nvidia Spectrum-X Photonics availability** in H2 2026 — first volume Ethernet CPO design; pulls demand into Coherent/Lumentum capacity.
- **1.6T transceiver ramp** at hyperscalers (Google, Meta, Microsoft) through FY26-FY27 — the supply-demand spread tightens further as 200G/lane EMLs go GA.
- **LITE capacity expansion** — additional InP fab investment funded by Nvidia $2B.
- **COHR 6-inch InP yield curve** — cost-per-laser declines drive both share and margin.
- **Astera Scorpio X-Series 320-lane ramp** in H2 FY26 and Scorpio becoming the largest product line by exit FY26.
- **800G ZR/ZR+ coherent DCI** ramp for distributed AI training / inference fan-out (Marvell, Cisco, Coherent).
- **IEEE 802.3dj completion (late 2026)** unlocks 200G/lane standardized products at 200G/400G/800G/1.6T.
- **UALink and NVLink Fusion** monetization (ALAB) in 2027.

## Risks

- **InP/EML supply** is a hard physical constraint — only a handful of fabs worldwide; capacity adds take 12-24 months.
- **CPO yield and serviceability** still unproven at hyperscaler scale; if fiber-attach reliability disappoints, pluggables (and pluggable optics suppliers) extend their reign — but if CPO succeeds, transceiver TAM compresses long-term.
- **Concentration risk.** Coherent/Lumentum revenue increasingly correlated to Nvidia and a small number of hyperscaler customers.
- **Astera competitive pressure** — Scorpio fabric goes head-to-head with Broadcom in switching, a much harder fight than retimer share gain.
- **Pricing.** As capacity catches up in 2027-2028, transceiver ASPs compress; today's supply-constrained margins are not the steady state.
- **Customer in-housing** — Google's optical roadmap and Meta's silicon photonics work could displace merchant suppliers over time.
- **CFO departure at ALAB** (announced with Q4 FY25 print) introduces near-term execution risk.

## Sources
- [Global AI Optical Transceiver Market to Reach $26B in 2026 — TrendForce](https://www.trendforce.com/presscenter/news/20260420-13017.html)
- [NVIDIA's $4B Optics Bet Signals Photonics as AI's Next Bottleneck — Futurum](https://futurumgroup.com/insights/nvidias-4b-optics-bet-signals-photonics-as-ais-next-bottleneck/)
- [Coherent Corp. (COHR) 2026 Deep-Dive: The 1.6T Networking Supercycle](http://markets.chroniclejournal.com/chroniclejournal/article/finterra-2026-2-23-coherent-corp-cohr-2026-deep-dive-the-16t-networking-supercycle-and-the-anderson-turnaround)
- [Lumentum: from fiber to the heart of AI — MarketScreener](https://www.marketscreener.com/news/lumentum-from-fiber-to-the-heart-of-ai-ce7d51d2d08ef426)
- [Fabrinet (FN) Q3 2026 Earnings Transcript — Motley Fool](https://www.fool.com/earnings/call-transcripts/2026/05/04/fabrinet-fn-q3-2026-earnings-transcript/)
- [Astera Labs Reports First Quarter 2026 Financial Results](https://ir.asteralabs.com/news-releases/news-release-details/astera-labs-reports-first-quarter-2026-financial-results)
- [Astera Labs Q1 FY 2026 Earnings Show Scale-Up Switching Ramp — Futurum](https://futurumgroup.com/insights/astera-labs-q1-fy-2026-earnings-highlight-scale-up-switching-ramp/)
- [Marvell Q1 FY 2026 Results — Futurum](https://futurumgroup.com/insights/marvell-q1-fy-2026-results-driven-by-custom-silicon-and-data-center-momentum/)
- [Scaling AI Factories with Co-Packaged Optics — NVIDIA Developer Blog](https://developer.nvidia.com/blog/scaling-ai-factories-with-co-packaged-optics-for-better-power-efficiency/)

---

## Fabric — Arista + NVDA Spectrum-X

## Current state (May 2026)

AI back-end fabric — the network that connects accelerators inside a training pod — is now the most strategically important slice of data-center networking. Three architectures contest it: (1) **Nvidia InfiniBand (Quantum)**, (2) **Nvidia Spectrum-X Ethernet**, (3) **merchant Ethernet** powered by Broadcom Tomahawk/Jericho and built into systems by Arista, Cisco, Juniper/HPE, and white-box ODMs.

**Arista Networks (ANET).** Q1 2026 revenue **$2.71B (+35.1% YoY)**, beat $2.6B guide. FY26 guide **raised to ~$11.5B (+27.7%)**; **AI fabric revenue target raised from $3.25B to $3.5B**, more than doubling YoY. Campus target $1.25B. Q2 guide: ~$2.8B, 62-63% GM, 46-47% op margin, EPS ~$0.88. Microsoft and Meta remain 10%+ customers; Oracle and Google are increasingly cited as potential incremental 10% customers, notably through **Google's "Virgo Fabric" deployment**. "Scale-across" (multi-DC AI fabric using 7800R3/R4 routers) is expected to be **at least one-third** of the $3.5B AI revenue target in 2026 — a structurally new line item that didn't exist 18 months ago. Stock fell 12.57% after the clean double-beat print because the in-line Q2 guide couldn't clear a +34% pre-print rally. Watch deferred revenue ($6.2B at Q1 print) trending toward $7B in Q2 — that's the cleanest backlog tell for AI fabric acceptance cycles.

**Nvidia Spectrum-X.** Spectrum-X (Ethernet) now **outsells Quantum InfiniBand in the Blackwell GPU series** — a meaningful inflection. xAI's 100K-GPU Colossus runs on Spectrum-X, not InfiniBand. Spectrum-X Photonics with CPO (Spectrum-6 ASIC, **102.4 Tbps**, SN6810; option for 4-ASIC **409.6 Tbps** configuration) ships H2 2026. Quantum-X InfiniBand Photonics (115 Tbps, 144 × 800G ports, 4th-gen SHARP, liquid cooled) ships early 2026. Nvidia is also a UEC member — symbolic acknowledgment that Ethernet wins long-term in back-end.

**Ultra Ethernet Consortium (UEC).** **Spec 1.0 published June 11, 2025**; **1.0.1 update September 2025**. 560+ page spec defining a full vertically-integrated stack: modern RDMA, transport, packet spraying with NIC-side reordering, congestion control without lossless dependency, 1-20µs round-trip target. Founding members include AMD, Arista, Broadcom, Cisco, Eviden/Atos, HPE, Intel, Meta, Microsoft — Nvidia subsequently joined. **2026 priorities**: Programmable Congestion Management (PCM), Congestion Signaling (CSIG), In-Network Collectives (INC). **Dell'Oro projects Ethernet surpasses InfiniBand in AI back-end share by 2027.**

**Cisco (CSCO) — not sidelined.** Cisco's AI infrastructure story has materially improved. Quarterly hyperscaler AI orders: **Q1 FY26 $1.3B → Q2 FY26 $2.1B → Q3 FY26 $1.9B**, $5.3B YTD; FY26 AI infrastructure order guide **raised from $5B to $9B** (~4x FY25). Q3 FY26 disclosed **5 new hyperscaler design wins** (2 optics, 3 systems): first two **Silicon One P200 (51.2 Tbps scale-across)** wins, one **G200 (scale-out)** win; an additional P200 design win followed in early Q4. **Silicon One G300 (102.4 Tbps)** was unveiled at Cisco Live Amsterdam (Feb 10, 2026), powering new N9000 and 8000 series for AI clusters. Cisco shipped its 1-millionth Silicon One chip in Q2. Silicon supply secured through CY2026; CY2027 in negotiation. Top-5 hyperscalers each posted triple-digit Cisco order growth. CEO Chuck Robbins's framing: AI infrastructure players "without silicon will struggle to be relevant."

**Juniper / HPE.** **HPE's $14B acquisition of Juniper closed July 2025** after DOJ initially opposed (settlement required HPE divest Aruba Instant On in 180 days and license Juniper Mist AI source code). The combined HPE Networking unit, run by ex-Juniper CEO Rami Rahim, is pursuing "AI for Networks" (Mist AIOps) + "Networking for AI" (data-center fabric for GPU clusters). HPE projects networking >50% of operating income in 2026. December 2025 (HPE Discover Barcelona): expanded AI-native networking portfolio across Aruba + Juniper. Juniper is a vocal UEC supporter (packet spraying / NIC reordering). Still positioned more as a #2/#3 alternative to Arista/Cisco in hyperscaler back-end AI fabric.

**Front-end vs. back-end split.** Arista's framing: scale-out (within-cluster back-end) remains primary; scale-across (cross-DC) is the new growth vector at 1/3+ of AI revenue. Front-end (general data-center / cloud) continues to grow steadily but is no longer where the marginal AI dollar flows.

## Key catalysts

- **Arista Q2 2026 print (early August 2026)** — deferred revenue ($6.2B → $7B?), AI fabric revenue trajectory toward $3.5B FY target, any additional 10% customer reveal (Oracle, Google).
- **Nvidia Spectrum-X Photonics (Spectrum-6) GA** in H2 2026 — first Ethernet CPO at 102.4 Tbps; competitive overlap with TH6 Davisson.
- **Cisco FY26 close** ($9B AI infrastructure orders) and **Silicon One G300 (102.4T)** customer ramps in CY2026/27.
- **UEC PCM/CSIG/INC** specifications landing in 2026; first UEC-compliant NICs and switches shipping in volume.
- **IEEE 802.3dj completion (late 2026)** — 200G/lane standardization unlocks 1.6T port economics.
- **HPE Juniper** — first joint AI fabric customer wins post-integration.
- **Google Virgo Fabric** deployment scale at Arista.
- **Dell'Oro 2027 Ethernet > InfiniBand cross-over** — milestone the bull case for ANET / Broadcom merchant model relies on.

## Risks

- **Customer concentration.** Microsoft + Meta still dominate ANET revenue; a capex pause at either is material. Cisco's $9B AI is concentrated in a few hyperscalers as well.
- **Nvidia full-stack vertical integration.** If Spectrum-X + ConnectX-8 NIC + Quantum-X gain share in back-end, merchant switch vendors (Arista, Cisco) compete only in scale-across and front-end.
- **Ethernet vs InfiniBand timing.** UEC ecosystem maturity (PCM/CSIG/INC) determines how quickly Ethernet eats InfiniBand share; delays favor Nvidia Quantum.
- **CPO disruption.** If CPO ramps faster than expected and hyperscalers consume bandwidth via OEM/Nvidia stacks, Arista risks margin compression on pluggable-attach economics.
- **Component supply.** ANET, CSCO, HPE all flagged memory, wafer, optics, CPU shortages as 2026 margin headwinds.
- **Valuation set-up.** ANET sold off 12.57% on a clean beat — the bar has been raised; subsequent quarters need acceleration to clear it.
- **Macro / tariffs / cloud capex.** A cloud capex pause in 2H26 / 2027 is the biggest external shock vector.
- **HPE integration risk.** Juniper integration complexity, Mist AI source-code licensing to competitors, and Aruba Instant On divestiture could slow execution.

## Sources
- [Arista (ANET) Q1 2026 Earnings Transcript — Motley Fool](https://www.fool.com/earnings/call-transcripts/2026/05/05/arista-anet-q1-2026-earnings-transcript/)
- [Arista Networks Q1 2026 8-K Earnings Release](https://www.sec.gov/Archives/edgar/data/0001596532/000159653226000074/ex991q126-earningsrelease.htm)
- [Arista Networks Stock Fell 12.57% After a Q1 2026 Beat](https://www.tikr.com/blog/arista-networks-stock-fell-12-57-after-a-q1-2026-beat-heres-what-a-350-target-means-for-investors)
- [Cisco Raises AI Infrastructure Guidance 80% to $9B on $1.9B Q3 Hyperscaler Orders](https://convergedigest.com/cisco-q3-revenue-hits-record-15-8b-as-ai-infrastructure-orders-reach-5-3b-ytd/)
- [Cisco Announces New Silicon One G300](https://newsroom.cisco.com/c/r/newsroom/en/us/a/y2026/m02/cisco-announces-new-silicon-one-g300.html)
- [Cisco Q1 FY 2026: AI Demand Lifts Outlook and Orders — Futurum](https://futurumgroup.com/insights/cisco-q1-fy-2026-ai-demand-lifts-outlook-and-orders/)
- [UEC Launches Specification 1.0](https://ultraethernet.org/ultra-ethernet-consortium-uec-launches-specification-1-0-transforming-ethernet-for-ai-and-hpc-at-scale/)
- [UEC publishes 1.0 spec — Network World](https://www.networkworld.com/article/4006285/ultra-ethernet-consortium-publishes-1-0-specification-readies-ethernet-for-hpc-ai.html)
- [Ethernet groups keep 2026 focus on higher bandwidth, AI demands — Network World](https://www.networkworld.com/article/4113364/ethernet-groups-keep-2026-focus-on-higher-bandwidth-ai-demands.html)
- [NVIDIA Silicon Photonics Networking for Agentic AI](https://www.nvidia.com/en-us/networking/products/silicon-photonics/)
- [HPE Closes $14B Acquisition of Juniper Networks](https://www.networkstraining.com/hpe-juniper-acquisition/)
- [HPE Closes Juniper Acquisition — Futurum](https://futurumgroup.com/insights/hpe-closes-juniper-acquisition-combining-ai-native-networking-portfolios/)

---

## Hyperscaler capex

## Current state (May 2026)

The Big Five US hyperscalers (MSFT, GOOGL, META, AMZN, ORCL) have collectively guided to **$660-725B in 2026 capex**, roughly doubling 2025's ~$410B and tripling 2024 levels. Q1 2026 earnings (late April) were the official inflection: every name raised. ~75% (~$450-545B) is AI-specific (GPUs, custom silicon, datacenter shells, power, cooling).

**Per-company FY2026 guidance:**
- **Microsoft**: ~$190B calendar-2026 (up from $152B analyst consensus). CFO Amy Hood attributed $25B of the lift to memory/HBM cost inflation. MSFT disclosed an **$80B Azure backlog it cannot fulfill** due to power constraints — expects to remain capacity-constrained through 2026. FY2025 capex was ~$88B; FY2026 tracking >$120B with $37.5B spent in a single recent quarter.
- **Alphabet/Google**: $180-190B (raised $5B at Q1). Google Cloud growth strong; ~75% of Gemini compute now runs on internal TPU v7 Ironwood.
- **Amazon**: ~$200B (~62% AI). Most aggressive cash impact: Morgan Stanley sees -$17B FCF; BofA sees -$28B in 2026. Heavy spend behind Anthropic's $100B AWS commit (Project Rainier, Trainium2/3).
- **Meta**: $115-135B (CFO twice raised to $145B at Q1). Stock dropped ~6% after the latest hike; market is pricing in AI ROI scepticism on META specifically.
- **Oracle**: $50B FY26 (up from $35B; 136% YoY). FY25 was ~$21B. Carries a $523B RPO (Remaining Performance Obligation, +438% YoY), the largest in software history.

**Capex/revenue ratios** are at historically unthinkable levels: Oracle 76%, Microsoft 38-45%, Google 33%, Amazon 28%, Meta 30%. Aggregate Big Five capex + buybacks + dividends now exceeds operating cash flow — debt funding is required. Morgan Stanley expects >$400B in hyperscaler debt issuance.

**Oracle's surprise emergence** is the structural change of the cycle. Pre-2025 ORCL was a back-office software laggard. The OpenAI deal — $60B/yr for five years (2027-31) for $300B total, plus 4.5 GW Stargate buildout — made it the marginal buyer of GPU racks. ORCL is now consuming ~400K GB200s for Abilene alone and has taken on ~$124B in debt (up from $89B a year ago) to finance the build. Moody's Baa2 outlook is negative; the stock is down ~24% YTD.

**Tesla** raised 2026 capex 3x to $25B (from $8.5B in 2025), with ~$10-12B of that AI-related (Cortex 2 online, Dojo 3 in development, Austin Terafab semi research, AI5/AI6 inference silicon). Tesla is openly steering away from Nvidia and has guided negative FCF for the rest of 2026.

**Apple** remains conspicuously absent from the hyperscaler capex race. Strategy is partnership (OpenAI for Apple Intelligence) + Private Cloud Compute at small scale, with capital still going to ~$100B+/yr in buybacks. Apple has not published an AI capex line item that would put it in the same conversation.

## Key catalysts

- **Stargate execution** drives ORCL specifically: Abilene Phase 1 live (1.2 GW), six more Stargate sites under construction (Shackelford TX, Doña Ana NM, Lordstown OH, Milam County TX, Wisconsin/Vantage, Saline MI), plus UAE/Argentina/Norway/UK overseas. ~7 GW planned vs. $500B/10 GW original headline.
- **Custom silicon ramp** in 2026: TPU v7 Ironwood (Google), Maia 200 (Microsoft, TSMC N3, OpenAI inference), Trainium 3 (AWS, 1M+ Trainium2 already deployed, Trn3 UltraServer), MTIA 400 (Meta, 4-gen Broadcom deal). Custom ASIC market growing 44.6% CAGR; Nvidia inference share projected to fall from 90%+ to 20-30% by 2028.
- **Anthropic's $100B AWS commit** (April 2026) locks in ~5 GW of Trainium2/3 capacity through 2035 — gives Amazon visibility most peers lack.
- **Power constraints, not GPU supply, are now the binding limit.** MSFT's $80B unfulfillable backlog is the canonical example.

## Risks

- **Depreciation cliff**: ~20%/yr depreciation on $2T of AI assets being added by 2030 implies ~$400B/yr depreciation expense — more than Big Five combined 2025 profits. If revenue doesn't compound fast enough, GAAP earnings collapse.
- **AI revenue undershoot**: OpenAI ($25B ARR) + Anthropic ($30-45B) combined are ~$55-70B vs. $725B 2026 capex. The gap is justified only by 2027-2030 enterprise inflection — Gartner calls 2026 the "trough of disillusionment."
- **Free cash flow inversion**: AMZN FCF turning negative; ORCL FCF already -$10B in a quarter. Buybacks slowing or pausing is a real risk if balance sheets tighten.
- **Oracle/Stargate execution**: 600 MW Abilene add-on already scrapped; partner disputes (OAI/ORCL/SoftBank) reported around control. ORCL's 76% capex/revenue + Baa2 negative is the cycle's fragile node.
- **Meta-specific demand signal**: 6% stock drop on the latest capex raise is the first "saturation" signal from a public-market reaction.
- **Asset useful-life accounting**: All hyperscalers extended GPU useful lives 2023-24 to flatter earnings; reverse looks likely if 2026 Blackwell obsolescence accelerates.

## Sources
- [Google, Microsoft, Meta, Amazon $725B capex (Yahoo Finance / FT)](https://finance.yahoo.com/sectors/technology/articles/google-microsoft-meta-amazon-capex-131823436.html)
- [Tech AI spending approaches $700B in 2026 (CNBC, Feb 2026)](https://www.cnbc.com/2026/02/06/google-microsoft-meta-amazon-ai-cash.html)
- [AI Capex 2026: The $690B Infrastructure Sprint (Futurum)](https://futurumgroup.com/insights/ai-capex-2026-the-690b-infrastructure-sprint/)
- [Hyperscaler capex > $600B in 2026 (IEEE ComSoc)](https://techblog.comsoc.org/2025/12/22/hyperscaler-capex-600-bn-in-2026-a-36-increase-over-2025-while-global-spending-on-cloud-infrastructure-services-skyrockets/)
- [Oracle $50B capex / $300B OpenAI deal (IntuitionLabs)](https://intuitionlabs.ai/articles/oracle-openai-300b-deal-analysis)
- [Oracle OCI backlog $523B (ERP Today)](https://erp.today/oracle-loads-up-on-ai-infrastructure-as-oci-backlog-data-center-commitments-surge/)
- [Tesla Q1 2026: $25B capex, AI compute doubling (Abhishek Gautam)](https://www.abhs.in/blog/tesla-q1-2026-25-billion-capex-optimus-july-cybercab-ai-april-2026)
- [Custom silicon inflection 2026 (Introl)](https://introl.com/blog/custom-silicon-inflection-2026-hyperscaler-asics-nvidia-gpu)
- [Custom AI ASIC state of play May 2026 (Tom's Hardware)](https://www.tomshardware.com/tech-industry/semiconductors/custom-ai-asics-examined-from-broadcom-to-mtia)

---

## AI labs — OpenAI, Anthropic, xAI, Mistral

## Current state (May 2026)

The four-lab cohort has bifurcated sharply: OpenAI and Anthropic are at $25-45B ARR with hundred-billion-dollar capex commitments; xAI and Mistral are an order of magnitude smaller in revenue but each plays a strategic role (Musk/sovereign respectively).

### OpenAI
- **ARR**: $25B as of Feb 2026 (Sacra/CFO Sarah Friar), up from $20B end-2025, $6B in 2024, $2B in 2023. Enterprise now >40% of revenue, on track to reach parity with consumer by year-end.
- **Valuation**: $852B post-money on a $122B round closed March 31, 2026 (SoftBank-led; a16z, MGX, TPG, T. Rowe; Amazon, NVIDIA, MSFT participated strategically). Microsoft's PBC stake valued at ~$135B (~27% as-converted diluted). Secondary markets had already implied >$1T earlier in May.
- **Burn / losses**: $14B projected loss in 2026; ~$27B cash burn 2026, ~$63B in 2027. Gross margin only 33%. Inference cost $8.4B in 2025, projected $14.1B in 2026. Breakeven pushed to 2030.
- **Stargate** is the binding capex commitment: $500B / 10 GW headline, ~7 GW now under construction across Abilene TX + 6 US sites + UAE/Norway/UK/Argentina. The $300B Oracle contract (2027-31, $60B/yr) is real on paper but contingent on OpenAI revenue growth that more than 10x's from here.
- Internal docs project >$1T in compute commitments over the next several years. Bloomberg (Aug 2025) reported Stargate had not actually raised the initial $500B; reality is somewhere between marketing and committed capex — flagship Abilene is operational, but the financing stack for full $500B is not closed.

### Anthropic
- **ARR**: $30B run-rate (April 2026, per Dario Amodei — 80x YoY); Sacra estimates **$45B in May 2026**, up from $9B end-2025. **Anthropic passed OpenAI in revenue.** (OpenAI disputes the comparability; using OpenAI's net methodology, Anthropic would be ~$22B — still neck-and-neck.)
- **Mix**: ~80% enterprise API / dev. >1,000 customers spending >$1M/yr (doubled from 500+ in two months). Claude Code went from $0 to $2.5B ARR in <12 months (May 2025 GA → Feb 2026).
- **Valuation**: $380B post-money on the Feb 2026 Series G ($30B led by GIC + Coatue). In May 2026 raising another $30B+ at pre-money >$900B; secondaries imply $1T.
- **AWS deal (April 2026)**: $100B+ AWS commit over 10 years for **up to 5 GW of Trainium2/3/4 capacity**, plus Amazon investing up to $25B more (total $33B). >1M Trainium2 chips already in Project Rainier. Anthropic also rented **all of xAI's Colossus 1** capacity (May 2026) — a striking secondary-market signal that xAI overbuilt.
- Projects positive FCF by 2027 vs. OpenAI's 2030. Targeting an October 2026 IPO at >$60B raise.

### xAI
- **Colossus Memphis**: ~555K GPUs as of Feb 2026 (150K H100 + 50K H200 + 30K GB200 + 555K Blackwell at Colossus 2 buildout). $18B in GPUs alone. 2 GW total site power; on-site gas plant under construction. Third building ("MACROHARDRR") acquired Dec 2025; target 1M GPUs by late 2026 to train Grok 5 (rumored 6T-param MoE).
- **Revenue**: only $59M in Q2 2025; product revenue trails badly behind capex. The $20B SPV from Nvidia (GPU-collateralized) is keeping xAI capitalized.
- **Saudi xAI/HUMAIN**: 500 MW facility with Brookfield's $100B Nvidia program — xAI's first non-US site.
- **Distress signal**: Anthropic taking all of Colossus 1 (May 2026) implies Grok user growth has not absorbed xAI's own capacity — the lab is now a de facto neocloud provider to Anthropic. Reports of xAI/SpaceX needing balance-sheet support from SpaceX.

### Mistral
- **ARR**: ~$400M January 2026 (Sacra), up from ~$16M end-2024. ~20x annual growth. Public target $1B+ in 2026. ~60% of revenue from Europe.
- **Funding**: $3-4B total raised across 8 rounds; $1.7B Series C (Sept 2025) led by ASML at €11.7B post-money. **$830M debt round in March 2026** to buy ~13.8K Nvidia GPUs for a Paris-area datacenter — first time a European AI lab debt-financed hyperscale compute without US VC.
- **Strategy**: own 200 MW of independent EU capacity by end-2027, outside the EU gigafactory program. Mistral is the only credible non-US/non-China frontier lab and is intentionally moving faster than EU procurement timelines.

### DeepSeek / Cohere (smaller cohort)
- **DeepSeek**: First-ever fundraise underway, valuation jumped from $20B to $45B (FT/Bloomberg, May 2026), led by China Integrated Circuit Industry Investment Fund, with Tencent/Alibaba participating. Liang Wenfeng holds ~90%. Revenue not disclosed; market is pricing it on technology-definer status, not ARR.
- **Cohere**: $1.64B raised cumulatively; valuation tripled in 2 years. Enterprise/Canadian sovereign focus. Reliant (Montreal) acquired May 2026.

## Key catalysts

- **Anthropic IPO (Oct 2026 target)** would be the largest tech IPO since Aramco — secondaries already at $1T-implied.
- **OpenAI cash needs**: $27B 2026 burn vs. $25B ARR means ongoing rounds; SoftBank's $41B already deployed.
- **Stargate site activations** (Wisconsin, Michigan, NM, Ohio coming online H2 2026) — concrete signal whether the $400B in committed capex actually shows up as Oracle revenue.
- **Grok 5 release** + xAI's $20B Nvidia SPV maturity test xAI viability.
- **EU gigafactory call decisions Q2 2026** — Mistral is the only EU lab with the model quality to consume them.
- **DeepSeek funding round close** at $45B+ would normalize Chinese frontier-lab valuations and validate Tencent/Alibaba as model-layer backers.

## Risks

- **Stargate financing gap**: $500B nominal vs. ~$100-150B of real committed paper. If OpenAI ARR growth tapers below ~50%/yr, the $60B/yr Oracle contract becomes a credit event for ORCL.
- **xAI overbuild visibility**: Anthropic renting Colossus 1 is the first clear "AI lab overbuilt" signal in this cycle.
- **Anthropic concentration on AWS Trainium** if Trainium 3/4 underperforms Nvidia Vera Rubin on perf/$.
- **Mistral scale gap**: $400M ARR vs. $30B (Anthropic) means EU may not have a frontier-scale champion regardless of gigafactories.
- **DeepSeek/Chinese export-control overhang**: chips access remains uncertain; sovereign capital pricing it on geopolitics, not unit economics.
- **Lab→hyperscaler dependence**: every lab is now structurally locked to one hyperscaler (OAI→MSFT+ORCL, Anthropic→AWS, xAI→Oracle/SpaceX/HUMAIN, Mistral→on-prem+ASML). Cross-cutting failure modes increase.

## Sources
- [Anthropic $30B ARR, 80x growth (VentureBeat)](https://venturebeat.com/technology/anthropic-says-it-hit-a-30-billion-revenue-run-rate-after-crazy-80x-growth)
- [Anthropic + Amazon up to 5 GW Trainium / $100B commit (Anthropic)](https://www.anthropic.com/news/anthropic-amazon-compute)
- [Amazon $25B investment in Anthropic (CNBC, April 2026)](https://www.cnbc.com/2026/04/20/amazon-invest-up-to-25-billion-in-anthropic-part-of-ai-infrastructure.html)
- [OpenAI revenue & valuation (Sacra)](https://sacra.com/c/openai/)
- [Anthropic revenue & valuation (Sacra)](https://sacra.com/c/anthropic/)
- [OpenAI Stargate $500B / 7 GW (OpenAI)](https://openai.com/index/five-new-stargate-sites/)
- [Stargate $300B Oracle deal (IntuitionLabs)](https://intuitionlabs.ai/articles/oracle-openai-300b-deal-analysis)
- [xAI Colossus 2 GW / 555K GPUs (Introl)](https://introl.com/blog/xai-colossus-2-gigawatt-expansion-555k-gpus-january-2026)
- [xAI 1M GPU expansion plan (DCD)](https://www.datacenterdynamics.com/en/news/xai-elon-musk-memphis-colossus-gpu/)
- [Mistral revenue & ASML round (Sacra)](https://sacra.com/c/mistral/)
- [DeepSeek $45B valuation talks (TechCrunch)](https://techcrunch.com/2026/05/06/deepseek-could-hit-45b-valuation-from-its-first-investment-round/)
- [Anthropic vs OpenAI revenue race (SaaStr)](https://www.saastr.com/anthropic-just-passed-openai-in-revenue-while-spending-4x-less-to-train-their-models/)

---

## Sovereign + enterprise AI

## Current state (May 2026)

Sovereign AI has moved from policy talking point to actual capital. The UAE, Saudi Arabia, India, and the EU each have **multi-billion-dollar national programs with concrete 2026 datacenter deliveries**. Enterprise AI is the other under-discussed leg: server vendors (Dell, SMCI, HPE) are showing 100-340% YoY AI revenue growth as enterprise upgrade cycles kick in, and Gartner expects 2026 to be the enterprise inflection year.

### UAE — G42 + Microsoft + Stargate UAE
- **Microsoft total UAE commitment: $15.2B** through 2029, with $7.9B new in 2026-29. $5.5B earmarked for AI/cloud infrastructure expansion.
- **Stargate UAE**: 1 GW cluster in Abu Dhabi, built by G42 (Khazna), operated by OpenAI + Oracle, with Cisco, SoftBank, and Nvidia GB300. **First 200 MW online by end-2026.** Headline framing: "serves up to half the world's population within ~2000 mi." Eventually scales to 5 GW.
- **Khazna Data Centers** (G42 subsidiary) announced its own separate 1 GW expansion in Oct 2025. MGX + Silver Lake invested; e& exited.
- **Export licenses**: Microsoft secured Trump-administration approval to ship the equivalent of 60,400 A100s (in GB300 form) — the first company to clear the new regime.
- **MGX** (Mubadala-anchored AI vehicle) targeting $100B+ AUM; participated in OpenAI's $122B round.

### Saudi Arabia — HUMAIN (PIF)
- **HUMAIN** announced May 2025 (one day before Trump's visit), led by Tareq Amin (ex-Rakuten Mobile). PIF parent has $925B AUM.
- **Commitments**: $23B for strategic partnerships, $10B venture fund. Plans **600,000 Nvidia GB300-class chips over 3 years**.
- **Buildout**: 2 large campuses, 11 datacenters, each 200 MW. 50 MW added per quarter through 2026. **Target: 1.9 GW by 2030, 6 GW by 2034.**
- **First 18,000 GB300 shipment received** Q1 2026. Riyadh + Dammam centers (100 MW each) launching Q2 2026.
- **xAI–HUMAIN partnership**: 500 MW Saudi facility (xAI's first non-US site), funded via Brookfield's $100B Nvidia-backed infrastructure program. Includes Grok deployment across the Kingdom.
- **AWS / Global AI / xAI** all announced expanded partnerships at the Nov 2025 US-Saudi Investment Forum.

### India — IndiaAI Mission
- **Government mission**: ₹10,372 crore ($1.25B) over 5 years. Compute component $550M.
- **Current scale**: 34,000 GPUs available at ₹115-150/hour (~42% below market). **Target: 100,000 GPUs by end-2026.**
- **L&T** (Larsen & Toubro): Building India's largest gigawatt-scale Nvidia AI factory. Initial 30 MW Chennai, 40 MW Mumbai.
- **Yotta**: $2B for 20,736 Blackwell Ultra GPUs at Noida D2 (operational Aug 2026), plus $4B more / 40K+ GPUs planned. Hosting one of APAC's largest DGX Cloud clusters.
- **Sovereign models**: Sarvam-30B and Sarvam-105B launched Feb 18, 2026. Krutrim (Bhavish Aggarwal) committed ₹10,000 crore by 2026, partnership with Nvidia for India's largest supercomputer. BharatGen 17B MoE.
- **Total expected**: >$200B in AI investment in India over the next two years; cumulative GPU base may exceed 200K within two years (public + private).

### EU — InvestAI / AI Gigafactories
- **€200B InvestAI** initiative announced Feb 2025; **€20B for 4-5 AI Gigafactories** of 100K+ GPUs each (€3-5B per factory). EU contributes 17% of capex per the Jan 2026 EuroHPC JU amendment.
- **Call for proposals**: 76 expressions of interest from 16 member states in June 2025; formal call delayed to Q2 2026 (still no firm date as of May 2026). Consortia in contention: Deutsche Telekom + Brookfield (Germany), Scaleway's AION (France), Altice + NOS (Portugal), Nokia + Lumi (Finland), Cernavodă/Doiceşti (Romania).
- **Commercial activity is faster than the EU programme**: Microsoft + Nscale at Start Campus Sines, Portugal (12,600 Blackwell Ultra GPUs starting early 2026, scaling to 66,000+ Rubins by late 2027, 1.2 GW permit); Nvidia + Deutsche Telekom 10K-GPU "industrial AI cloud" in Germany.
- **Mistral** is the EU's effective frontier-model anchor, financing its own 200 MW datacenter independently with €830M debt — first European AI hyperscale build without US VC.
- **Cumulative European DC investment 2026-31: €176B forecast.**

### Enterprise AI / on-prem server buyers
- **Dell**: ISG revenue $60.8B FY26 (+40% YoY). AI-optimized server revenue $9.0B in Q4 FY26 (+342% YoY). **Backlog $18.4B**; FY27 AI server target ~$50B. Total FY27 revenue guide ~$140B.
- **SMCI**: Q2 FY26 revenue $12.68B (+123% YoY); 90%+ from AI GPU platforms. FY26 revenue goal $40B. Concentration risk: one customer = 63% of Q2. Inventory ballooned to $10.6B.
- **HPE**: $9.1B Q3 FY25 (+18% YoY). GreenLake + Juniper acquisition strengthening enterprise AI position. Enterprise upgrade cycle now driving demand vs. earlier hyperscaler-only phase.
- **Gartner enterprise AI spend forecast 2026**: $2.59T total AI spend (+47% YoY). AI infrastructure $1.43T (up from $975B in 2025) → $1.9T in 2027. AI-optimized servers alone +49% to 17% of AI spend. AI software grows to $453B (from $283B in 2025). Datacenter systems IT spending +55.8% in 2026.
- 2026 is Gartner's "Trough of Disillusionment" for AI software — incumbents (Microsoft, Salesforce, ServiceNow) will sell agentic features into existing footprints rather than new greenfield. 40% of enterprise apps to feature task-specific AI agents by end-2026 (vs. <5% in 2025).

## Key catalysts

- **HUMAIN's first 18K GB300 shipment** is the first concrete delivery under the new US export regime — validates Tier 2 pathway.
- **Stargate UAE 200 MW go-live** end-2026 is the first non-US Stargate node operational.
- **EU Gigafactory formal call (Q2 2026 expected)** — selection of 4-5 consortia would commit ~€20B and shape European AI sovereignty.
- **India 100K GPU public target end-2026** + Yotta + L&T private deployments push national capacity past 200K, the first non-US/China sovereign of consequence.
- **Dell FY27 $50B AI server target** and SMCI FY26 $40B — if hit, on-prem/enterprise GPU is a $90B+ market separate from hyperscaler capex.
- **Gartner enterprise inflection** in 2026: AI software grows from $283B to $453B (+60%) as agents embed into incumbent SaaS.

## Risks

- **US export controls reversal**: Trump-era loosening could snap back; Saudi/UAE deals depend on continued GB300+ access.
- **Sovereign capex without demand**: HUMAIN's 6 GW by 2034 assumes Saudi/regional demand that doesn't yet exist; risk of Saudi Arabia becoming a stranded compute market like xAI's Colossus 1.
- **EU program delays**: Formal call already pushed twice. Commercial buildouts (Sines, DT/Nvidia) are bypassing the sovereign program, potentially making it irrelevant.
- **Enterprise ROI undershoot**: Gartner explicitly calls 2026 the "Trough of Disillusionment." If enterprise AI agents don't deliver measurable ROI by H2 2026, software spend reverts to incumbent renewal mode.
- **Server vendor margin compression**: GPU + HBM cost inflation already squeezing Dell/SMCI/HPE margins; SMCI has 63% customer concentration risk + inventory bloat.
- **Geopolitics**: India-Pakistan, US-China, EU-US data sovereignty tensions could fragment compute markets and strand investments.
- **DeepSeek-style efficiency shocks**: a sovereign lab proving frontier capability at 1/10th the GPU footprint would devalue every gigawatt commitment listed above.

## Sources
- [Microsoft + G42 $15.2B UAE / Stargate UAE 200 MW (Microsoft)](https://news.microsoft.com/source/emea/2025/11/microsoft-and-g42-accelerate-uaes-digital-future-with-major-data-centre-expansion/)
- [Stargate UAE launch (OpenAI)](https://openai.com/index/introducing-stargate-uae/)
- [HUMAIN + Nvidia 600K GB300s (Nvidia)](https://nvidianews.nvidia.com/news/humain-and-nvidia-announce-strategic-partnership-to-build-ai-factories-of-the-future-in-saudi-arabia)
- [Saudi HUMAIN $23B / xAI 500MW (Data Centre Magazine)](https://datacentremagazine.com/news/humain-invests-us-3bn-in-xai-as-saudi-ai-data-centres-expand)
- [HUMAIN buildout: 1.9 GW by 2030 (CNBC)](https://www.cnbc.com/2025/08/27/saudi-arabia-wants-to-be-worlds-third-largest-ai-provider-humain.html)
- [India 34K GPU IndiaAI mission (Abhishek Gautam)](https://www.abhs.in/blog/indiaai-mission-34000-gpus-cheap-compute-developers-2026)
- [L&T gigawatt AI factory India (L&T)](https://www.larsentoubro.com/pressreleases/2026/2026-02-18-lt-teaming-with-nvidia-to-build-india-s-largest-gigawatt-scale-ai-factory)
- [India + Nvidia sovereign cloud (Nvidia blog)](https://blogs.nvidia.com/blog/india-ai-mission-infrastructure-models/)
- [EU InvestAI + €20B gigafactories (European Commission)](https://digital-strategy.ec.europa.eu/en/news/commission-and-european-investment-bank-group-team-up-to-support-ai-gigafactories)
- [EU sovereign AI stack 2026 (TechPlusTrends)](https://techplustrends.com/eu-sovereign-ai-infrastructure-stack-2026-guide/)
- [Dell FY26 ISG $60.8B (Dell 8-K)](https://www.sec.gov/Archives/edgar/data/0001571996/000157199626000003/exhibit991earnings8kq4fy26.htm)
- [SMCI Q2 FY26 $12.7B / 90% AI (Globe and Mail)](https://www.theglobeandmail.com/investing/markets/stocks/HPE/pressreleases/1068224/ai-gpu-platforms-drive-90-of-smcis-revenues-more-upside-ahead/)
- [Gartner $2.59T AI spend 2026 (Gartner)](https://www.gartner.com/en/newsroom/press-releases/2026-05-19-gartner-forecasts-worldwide-ai-spending-to-grow-47-percent-in-2026)
- [Gartner IT spending $6.31T 2026 (Gartner)](https://www.gartner.com/en/newsroom/press-releases/2026-04-22-gartner-forecasts-worldwide-it-spending-to-grow-13-point-5-percent-in-2026-totaling-6-point-31-trillion-dollars)

---

## Wafers + critical metals

## Current state (May 2026)

**300mm silicon wafers — tight oligopoly, AI-anchored demand.** The top five (Shin-Etsu ~32–33%, SUMCO ~23–27%, GlobalWafers ~19–20%, Siltronic ~12–13%, SK Siltron) control ~82–85% of 300mm revenue; top three alone are ~75%. The 300mm segment was ~$9.5B in 2025, growing into a ~$25.5B total wafer market in 2026. Shipment growth is being pulled by TSMC's $52–56B 2026 capex, HBM/advanced-logic ramps, and AI epi/SOI mix (epi wafers growing fastest at ~7.2% CAGR; SOI premiums of 80–120% over polished).

**Capacity moves into 2026:**
- **GlobalWafers** started Phase 2 of its Sherman, TX 300mm fab in January 2026 (part of a $7.5B total US investment).
- **SUMCO** is terminating 200mm production at Miyazaki by late 2026 to free capacity for AI-grade 300mm.
- **Shin-Etsu** is mid-build on a $1.5B Niigata 300mm expansion plus a ~$0.5B Japan lithography-materials fab (photoresist) — phase 1 targeted for 2026.

**Gallium / germanium.** China = ~98% primary gallium, ~80% germanium. After the Dec 2024 ban on exports to the US (China asserted extraterritorial jurisdiction over re-exports for the first time), gallium prices spiked >200%. Following the Trump–Xi summit, **China suspended the ban on Nov 9, 2025 through Nov 27, 2026**, but the legal framework remains in place and the export prohibition to US military end-users is still active. USGS estimated the ban could have caused a $3.4B hit to the US economy, half of it in semis. Each 5G base station uses 8–12 GaAs RF ICs; GaN now in 30–40% of new EV powertrain platforms (Tesla, VW, BMW, GM). MTM Critical Metals' Texas gallium-recovery plant starts in early 2026 with offtake terms via Indium Corp.

**Copper — the sleeper datacenter input.** Industry consensus: **~27–33 tonnes (27,000–33,000 kg) of copper per MW of datacenter capacity**, with hyperscale AI campuses reaching ~50,000 tonnes per facility. Mercuria pegs AI DC copper consumption at ~350kt in 2026 (~2.5% of global ~28Mt), rising to a projected peak of ~572kt by 2028. **Forecast 2026 deficits:** ICSG ~150kt; Wood Mackenzie wider gap on top of a 304kt 2025 shortfall; UBS >400kt. Copper has moved from ~$8,500/t two years ago to >$11,000/t; JPMorgan models $12,500 in Q2 2026 averaging $12,075; UBS sees $13,000 by year-end. BMO Capital Markets notes grid/transmission copper now exceeds in-fab copper demand — hyperscalers are "outbidding grid suppliers on transformer units."

**Gold for bonding.** Gold bonding wire market: ~$784M in 2025 to ~$1.2B by 2034 (6.5% CAGR); broader bonding wire ~$2.9B → $4.2B by 2032. ~62% of bonded chips globally still use gold wire — over 35% of premium ICs hold gold for fine-pitch and high-reliability auto/AI applications despite copper (PCC) and silver alloy substitution at the low end. Heraeus, Tanaka, Nippon Steel Chem & Material command >40% combined share. Gold price volatility is now a real cost-of-package input.

**Cobalt — clarify the linkage.** Cobalt demand is overwhelmingly battery-driven (EV cathodes), **not** front-end chips. Semiconductor exposure is incidental — small amounts in interconnect/diffusion-barrier processes and as a doping/alloy element. Treat as a battery/datacenter-storage node, not a wafer-input node.

**Rare earths (Nd, Pr, Dy, Tb).** Used in NdFeB permanent magnets for DC liquid-cooling pumps, EV traction motors, wind turbines, and defense actuators — not in chips themselves, but core to the power/cooling stack that surrounds them. **MP Materials (MP)** is the only fully integrated US producer:
- Targeting **6,000 t/yr NdPr by end-2026** (produced 2,599 t in 2025, +101% YoY).
- Fort Worth "Independence" magnet facility produced first commercial NdFeB magnets in Q4 2025; ramping from 1,000 to 3,000 t/yr.
- DoD owns ~15% on a fully diluted basis after a $400M preferred investment ($30.03 strike, 7% PIK), plus a **10-year $110/kg NdPr price floor** (~2x prior market) and a $150M loan for heavy-rare-earth (Dy/Tb/Sm) separation at Mountain Pass.
- $1.25B "10X" Northlake, TX magnet campus broke ground Feb 2026; commissioning 2028; +10,000 t/yr capacity with 10-yr DoD offtake for 100% of output.
- Even after China's Nov 2025 partial rollback, yttrium, terbium, dysprosium prices remained 598%, 195%, 168% above pre-restriction levels respectively.

## Key catalysts
- **Nov 27, 2026 expiry** of China's suspension on Ga/Ge/Sb/super-hard exports to the US — single biggest binary for upstream metals.
- GlobalWafers Sherman Phase 2 first wafer-out (2026); SUMCO Miyazaki 200mm shutdown timing.
- TSMC 2026 capex guide ($52–56B) and 2nm wafer-pricing pass-through (Arizona premium).
- MP Materials end-2026 NdPr run-rate milestone (6,000 t) and Independence magnet ramp.
- Copper deficit prints — first ICSG/WoodMac confirmation of 2026 deficit could spark another leg up.
- Hyperscaler capex (~$580B committed for 2026) flowing through to copper/transformer/grid orders.

## Risks
- **Single-country concentration repeats.** Japan = ~55% of 300mm; China = ~98% of gallium; Indonesia/DRC overhang for unrelated battery metals creates fungible policy risk.
- **China snap-back** of Ga/Ge controls post Nov 2026 — long-arm jurisdiction language is still on the books.
- **Copper grid-side bottleneck** could throttle DC commissioning even when chips are available — transformers and switchgear are the choke.
- **Gold price spikes** raise package BoM, particularly for auto/MCU vendors that haven't migrated to Cu/Ag.
- Heavy rare-earth (Dy/Tb) prices still elevated 168–598% — magnet costs flow into DC cooling pumps and EV margins.
- Taiwan/Korea concentration in epi and SOI wafer specialty mix means a Taiwan event hits wafers too, not just chips.

## Sources
- [SEMI / 300mm market structure synthesis (Future Market Insights)](https://www.futuremarketinsights.com/reports/semiconductor-wafers-market)
- [300mm Silicon Wafers Market 2026 outlook](https://www.linkedin.com/pulse/300mm-silicon-wafers-market-size-2026-key-highlights-la1ae/)
- [Stimson Center: China's germanium and gallium controls](https://www.stimson.org/2025/chinas-germanium-and-gallium-export-restrictions-consequences-for-the-united-states/)
- [CSIS: Beyond rare earths — China's threat to gallium supply](https://www.csis.org/analysis/beyond-rare-earths-chinas-growing-threat-gallium-supply-chains)
- [Fastmarkets: China suspends Ga/Ge/Sb prohibition](https://www.fastmarkets.com/insights/china-suspends-export-prohibition-on-superhard-materials-us/)
- [Pillsbury: China suspends export controls on critical minerals](https://www.pillsburylaw.com/en/news-and-insights/china-suspends-export-controls-certain-critical-minerals-related-items.html)
- [Tom's Hardware: AI datacenter copper deficit forecasts](https://www.tomshardware.com/tech-industry/ai-data-center-buildout-pushes-copper-toward-shortages-analysts-warn)
- [S&P Global: Copper in the Age of AI](https://www.spglobal.com/en/research-insights/special-reports/copper-in-the-age-of-ai)
- [Discovery Alert: Copper demand AI data centers 2026](https://discoveryalert.com.au/copper-demand-ai-data-centers-grid-infrastructure-supply-crunch/)
- [MP Materials: DoD public-private partnership announcement](https://mpmaterials.com/news/mp-materials-announces-transformational-public-private-partnership-with-the-department-of-defense-to-accelerate-u-s-rare-earth-magnet-independence/)
- [MP Materials: Northlake "10X" magnet campus](https://investors.mpmaterials.com/investor-news/news-details/2026/MP-Materials-Selects-Northlake-Texas-as-the-Site-of-10X-a-New-U-S--Rare-Earth-Magnet-Manufacturing-Campus/default.aspx)
- [Motley Fool: MP Materials integrated rare earth play](https://www.fool.com/investing/2026/05/06/the-only-fully-integrated-us-rare-earth-producer-h/)
- [Market Research Future: Gold bonding wire outlook](https://www.marketresearchfuture.com/reports/gold-bonding-wire-for-semiconductor-packaging-market-12626)

---

## Specialty gases + chemicals

## Current state (May 2026)

**Neon — restructured, not solved.** Pre-2022, Ukraine supplied ~70% of global neon and ~90% of US semiconductor-grade neon, mostly out of Ingas (Mariupol) and Cryoin (Odessa); Iceblick had already exited before the invasion. Global neon supply roughly halved in 2022 (from ~200M L to ~100M L). The predicted catastrophic shortage was averted because (a) fabs drew down inventory, (b) **neon recycle systems cut tool-level consumption by >90%**, and (c) **China stepped in** — Hangzhou Hangyang, Yingde Gases, Suzhou Jinhong, Wujiang Xinglu have scaled to become the dominant commercial supplier in 2026. Neon market is ~$374M in 2026, projected $728M by 2035 (7.6% CAGR). The structural risk has shifted: instead of "war in Ukraine," the chokepoint is now China concentration. Japan and South Korea continue self-sufficiency programs. Neon's long-run importance declines with EUV (13.5 nm) since EUV does not use neon — only DUV/ArF excimer lasers do.

**Xenon, krypton.** Same Ukrainian origin, same restructuring. Both are byproducts of air separation tied to steel-mill oxygen plants, so Russian/Chinese steel scale has translated into Russian/Chinese rare-gas supply. Used in ion implantation (Xe) and KrF lithography lasers (Kr). Prices have come off 2022 peaks but supply is structurally Asia-centric.

**Photoresists — the Japanese chokepoint.** Japan = ~91% of global photoresist supply. JSR led 2024 with >22% share; the top 5 (JSR, TOK, Fujifilm, Shin-Etsu, Dongjin Semichem) = ~50%. For EUV resists specifically, **JSR + Shin-Etsu supply photoresist used in ~90% of EUV lithography tools**. Market: $2.91B in 2025 → $3.24B in 2026 → $5.53B by 2031 (11.3% CAGR).

EUV/2nm capacity moves landing 2026:
- **TOK** new Koriyama building (EUV/ArF/KrF) — operational H2 2026; plus 20B yen ($130M) Korea fab announced (online 2030, 3–4x Korean capacity).
- **JSR** Korea metal-oxide-resist (MOR) plant — end-2026 startup; new Japan MOR development base.
- **Shin-Etsu** ~$0.5B Japan litho-materials fab — phase 1 by 2026.
- **Sumitomo Chem** Osaka photoresist expansion ramping FY25 → H1 FY26.
- **Adeka** 3.2B yen MOR metal-compound line — online April 2028+.
- TSMC locked multi-year EUV-resist supply contracts for the Arizona fab two years before ramp — confirming this is the strategic chokepoint, not a commodity.

**CMP slurries — Entegris (ENTG).** Post the 2022 CMC Materials acquisition, Entegris is the consolidated leader in CMP slurries + pads, plus advanced materials (CVD/ALD precursors, ion-implantation specialty gases, etch/clean formulations). Q1 2026 results:
- Revenue +5% YoY; Materials Solutions segment (slurries/pads/precursors) $351M, +2.8% YoY, 21.6% segment margin.
- Adjusted EBITDA guided to **27.0–28.0% of sales** for the year.
- Advanced logic = ~40% of revenue; well-positioned for 2026.
- **CMP slurry content doubles from N3 to N2** — a structural per-wafer content uplift directly capturing the leading-edge ramp.
- Won moly deposition position in 3D NAND, IPA purifier wins on HBM contamination.
- Taiwan and Colorado capacity that was underutilized through 2024–25 is now levering as volumes ramp = margin inflection story.

**Linde (LIN) — industrial gases.** 2025 sales $34B; Q1 2026 revenue $8.78B (+8% YoY), adj EPS $4.33 (+9%). Guidance raised at midpoint. Electronics is the explicit "bright spot" — ultra-high-purity gas demand from TSMC Arizona, Intel Ocotillo, and Samsung Taylor is structurally non-discretionary. CNBC characterized Linde as "the secret, quiet datacenter play."

**Air Liquide (AIQUY) — ~30% global IG share alongside Linde.** Q1 2026 revenue +3.5% comparable; **electronics sales +8.2%** explicitly cited as the growth driver. 2025 net income €3.3B, op margin 18.2%. North American ops are 25% of revenue; Texas and California sites feed AZ/TX fab cluster.

## Key catalysts
- TOK Koriyama EUV-resist building startup H2 2026; JSR Korea MOR plant end-2026.
- TSMC AZ Phase 2 ramp pulling resist + UHP gas + CMP slurry consumption into US.
- Entegris 2H 2026 margin lever as Taiwan/CO facilities fully utilize; advanced packaging slurry expansion is the next leg.
- Linde/Air Liquide on-site gas plants attached to new US fabs — long-dated cash-flow contracts.
- Any Korea/Japan policy friction (cf. 2019 H-F / photoresist / fluorinated polyimide dispute) recurs as a tail risk.

## Risks
- **China-concentration on neon** repeats the Ukraine vulnerability with different fault lines (could be tied to broader US–China tech escalation).
- **Photoresist single-source** — JSR or TOK supply disruption at one Japanese site would halt EUV nodes globally; no qualified substitute for ~6–12 months.
- Raw-material inflation flagged by Entegris management on Q1 call (Middle East logistics).
- Japan-Korea reprises 2019-style export friction on H-F / fluorinated polyimide / photoresist would hit Samsung + SK Hynix immediately.
- EUV/High-NA resist transitions (MOR) are still being qualified — any defect-rate issue delays 2nm ramp at TSMC/Samsung/Intel.
- US trade actions on specialty chemicals (tariffs, BIS additions) could rebound on US fabs that depend on Japanese inputs.

## Sources
- [USITC: Ukraine, neon, and semiconductors](https://www.usitc.gov/publications/332/executive_briefings/ebot_decarlo_goodman_ukraine_neon_and_semiconductors.pdf)
- [CSIS: Russia's invasion of Ukraine and chip-production gas markets](https://www.csis.org/blogs/perspectives-innovation/russias-invasion-ukraine-impacts-gas-markets-critical-chip-production)
- [SpecGas: Neon production by country 2026](https://specgasinc.com/feeds/blog/neon-gas-supply-country)
- [TrendForce: Japan ramps photoresist for 2nm — TOK, JSR](https://www.trendforce.com/news/2025/11/06/news-japan-ramps-up-photoresist-investment-for-2nm-chips-tokyo-ohka-kogyo-jsr-lead-the-charge/)
- [Fountyl: Japanese companies monopolize EUV photoresist](https://www.fountyltech.com/news/japanese-companies-monopolize-the-euv-photoresist-supply-market/)
- [Fortune Business Insights: Photoresist chemicals market 2026–2034](https://www.fortunebusinessinsights.com/photoresist-chemicals-market-115414)
- [Mordor Intelligence: Top photoresist companies](https://www.mordorintelligence.com/industry-reports/photoresist-market/companies)
- [Entegris Q1 FY2026 8-K](https://www.sec.gov/Archives/edgar/data/0001101302/000110130226000099/entgq12026ex991.htm)
- [Motley Fool: Entegris Q1 2026 transcript](https://www.fool.com/earnings/call-transcripts/2026/04/30/entegris-entg-q1-2026-earnings-transcript/)
- [BeyondSPX: Entegris margin inflection and content growth](https://beyondspx.com/quote/ENTG/margin-inflection-meets-content-growth-entegris-path-through-the-semiconductor-reset-nasdaq-entg)
- [Linde Q1 FY2026 8-K](https://www.sec.gov/Archives/edgar/data/0001707925/000165495426004202/lin_ex991.htm)
- [CNBC: Linde as the quiet datacenter play](https://www.cnbc.com/2026/05/01/linde-is-the-secret-quiet-data-center-play-that-keeps-winning.html)
- [Air Liquide Q1 2026 industrial gas results](https://www.ad-hoc-news.de/boerse/news/ueberblick/air-liquide-s-a-stock-fr0000120628-industrial-gases-leader-reports/69335128)
- [CEPR: Japan–Korea 2019 photoresist/HF dispute analysis](https://cepr.org/voxeu/columns/impact-export-controls-international-trade-evidence-japan-korea-trade-dispute)

---

## Geopolitics — China + Taiwan

## Current state (May 2026)

**US export-control architecture has shifted from rule-based denial to transactional licensing.** The Biden-era AI Diffusion Rule (Jan 15, 2025) — which would have created a tiered global VEU framework — was formally **rescinded by BIS on May 13, 2025** under the Trump administration. On the same day, BIS issued new guidance that:
- Asserts use of Chinese-developed 3A090 ICs (e.g., Huawei Ascend) likely violates the EAR's General Prohibition 10.
- Confirms EDA tools require licenses for PRC sales.
- Warns industry on diversion tactics.

**The new framework (mid-2025 → 2026):**
- **AI Action Plan (July 23, 2025)** + EO "Promoting the Export of the American AI Technology Stack": push "full-stack AI export packages" to allies; tighten enforcement against adversaries.
- **Nvidia/AMD revenue-sharing (Aug 11, 2025):** H20 and MI308 cleared for China sales with **15% of revenue paid to the US government** — reversing the April 2025 freeze.
- **VEU rollback (Sept 2025):** BIS removed Samsung and SK Hynix's named PRC facilities from the VEU program effective Dec 31, 2025.
- **Affiliates Rule suspended Nov 10, 2025** for one year.
- **Jan 15, 2026 final rule:** H200-class chips (Nvidia H200, AMD MI325X, and lesser-equivalents) moved from presumption-of-denial to **case-by-case review** for China/Macau exports. Conditions: must not reduce US-customer supply, buyer must have export-compliance procedures, product must pass independent US third-party security testing. **Tied to 25% tariff at US import**, of which 25% of revenue goes to the US government.
- **Existing fabs in China** (former VEU participants) will get operational licenses, but **no licenses to expand capacity or upgrade tech**.
- **Enforcement:** BIS FY26 budget +23%; DOJ "Operation Gatekeeper" (Dec 2025) disrupted $160M of AI-chip diversion to China/HK; $1.5M BIS settlement Jan 2026 against a European company for sub-channel transfers.

**China retaliation — escalation through 2025, partial truce post-summit.**
- **Dec 2024:** outright ban on gallium, germanium, antimony, super-hard materials to US — first use of extraterritorial "long-arm" enforcement under China's Export Control Law.
- **Feb 2025:** added tungsten, tellurium, bismuth, molybdenum, indium (41 HS codes) to license regime.
- **April 4, 2025 (Announcement 18):** added **seven heavy rare earths** (Sm, Gd, Tb, Dy, Lu, Sc, Y) plus all their alloys/oxides/magnets. These controls **have NOT been suspended** — they remain operative. CSIS data (May 2026): US yttrium imports collapsed from 333t to 17t over 8-month comparison windows; aerospace turbine-blade coatings are being rationed.
- **Oct 9, 2025 package:** China's FDPR-style extraterritorial expansion — any foreign product ≥0.1% Chinese-origin rare earths or using Chinese processing tech requires a license. Added 5 more elements (Ho, Er, Tm, Eu, Yb); plus controls on graphite anodes and rare-earth process equipment.
- **Nov 9, 2025 (post Trump–Xi summit) Announcement 72:** suspends Ga/Ge/Sb/super-hard ban + extraterritorial portion **through Nov 27, 2026**. Statutory framework remains on the books. Heavy-rare-earth controls remain in force; prices for Y, Tb, Dy still 598%, 195%, 168% above pre-restriction levels.
- **April 2026:** China added **40 Japanese companies** to its export control / unreliable entity list in response to alignment pressure.

**CHIPS Act implementation under Trump — equity-stake model.**
- Finalized awards: Intel $7.86B, TSMC $6.6B, Samsung $4.75B (cut 26% from preliminary).
- **Trump admin took ~10% Intel stake (~$10B at announcement; Trump claims now >$50B)** as quid pro quo for CHIPS subsidies; structure being templated for quantum (IBM/Anderon, Quantinuum, PsiQuantum, Atom Computing, Diraq splitting $2B in May 2026 with varying equity stakes).
- **Production milestones 2026:**
  - **Intel Fab 52 (Ocotillo, AZ) entered HVM on Intel 18A** in early 2026 — first US-located sub-2nm production using ASML High-NA EUV. Microsoft and Amazon engaged Intel Foundry as a TSMC alternative.
  - **TSMC Arizona** has accelerated 3nm to 2027 (vs. 2028); advanced packaging via Amkor partnership planned pre-2029. Apple expanding AZ-sourced advanced-chip orders.
  - **Samsung Taylor** signed Tesla (AI5/AI6 FSD) and Alphabet (next-gen TPU) multi-year agreements.
- Advanced Manufacturing Investment Credit raised from 25% → 35% in July 2025; SIA pushing extension past 2026 expiry.

**Onshoring metrics (SIA/BCG "Emerging Resilience"):**
- US fab share: 37% (1990) → 12% (2020) → 10% (2022) → projected **14% by 2032** (would have been 8% without CHIPS).
- US wafer-starts: +203% over the decade (1,121 → 3,393 kwspm 300mm-equiv).
- US share of advanced logic (<10nm) goes from ~0% to **28% by 2032**.
- US captures **28% of global $2.3T wafer-fab capex 2024–2032** (vs. 9% under pre-CHIPS baseline).
- 80+ new US semiconductor projects announced 2020–2023; $39B grants + $13B R&D catalyzed >$500B private investment.

**Taiwan risk premium — measurable, persistent.**
- TSMC trades at a structural discount to Broadcom and a small discount to Nvidia, explicitly attributed by analysts to "the Taiwan risk premium."
- Trailing P/E ~34.9x (~9% premium to sector median); DCF intrinsic range cited as $315–$580, with shares around $397–404.
- Bull case: 2nm gross margins held above 60%, Arizona price-passthrough functional, 50–85% upside if discount narrows.
- Bear case: no US/Japanese fab can replicate 3/2nm at scale within 5 years — a PRC blockade or kinetic action is a civilizational risk that no equity discount can fully price.
- The **"Arizona premium" is now real** — Apple, Nvidia, AMD are absorbing higher US wafer prices; TSMC gross margins guided 63–65% in upcoming print despite US/Japan fab dilution.
- US political pressure on TSMC AZ (preferential pricing, Intel 18A subsidies) is a margin-compression overhang specific to onshored capacity.

**Korea + Japan as middle powers — squeezed.**
- **MATCH Act (introduced April 2026):** within 150 days of enactment, Japan / Netherlands / others must adopt US-equivalent national export controls on chip equipment to China, or their equipment-makers (Tokyo Electron, SCREEN, Nikon, Advantest, Disco, ASML) get cut off from "countries of concern" by US action directly. Reverses prior "indirect US-nexus" leverage into direct extraterritorial sanction.
- Japan SME exports to China were ~JPY 820B (31% share) in 2022; controls under METI's March 2023 23-category rule already pulled this down.
- South Korea has **resisted full alignment** with US controls; Korean chip exports dropped 14% post Oct 2022 controls (memory -32%, discretes -26%).
- April 2026 China retaliation: 40 Japanese firms blacklisted.
- 2019 Japan–Korea precedent (H-F, photoresist, fluorinated polyimide controls on Korea) showed middle-power friction is real and recurring; Korea responded with $6B domestic-substitute investment.

## Key catalysts
- **Nov 27, 2026:** expiry of China's Ga/Ge/Sb suspension — binary moment for upstream metals.
- **MATCH Act passage** (150-day clock to allies) — could force Japan/NL into the US camp or trigger a fracture.
- **Intel Foundry external-customer wins** — if Microsoft/Amazon move volume tape-outs to 18A, the US onshoring story gets a step-change validation.
- TSMC AZ Phase 2 ramp + 3nm in 2027 — narrows the Taiwan-concentration thesis.
- Trump-administration Section 232 / tariff actions on chips (10% Intel stake model could be replicated; revenue-sharing on H200/MI325X could expand).
- US replacement framework for the rescinded AI Diffusion Rule — BIS has flagged publication but timing remains open.
- 2027 onset of new US tariffs on Chinese chips (cited in TSMC outlook) — could price out SMIC and reroute orders.

## Risks
- **Taiwan blockade/quarantine** — far higher probability than amphibious invasion; halts ~90% of leading-edge logic for weeks-to-quarters; no foreign equity holder has confidence in capital channels.
- **China snap-back** of suspended Ga/Ge/Sb controls + escalation of heavy-rare-earth licensing.
- **MATCH Act allied backlash** — Korea, Netherlands, or Japan could resist; outcome could be a fragmented control regime rather than unified front.
- **CHIPS Act renegotiation overhang** — Lutnick has signaled grant renegotiation; foreign investments in China by CHIPS recipients are a flashpoint.
- US-government equity-stake model in Intel sets precedent that could deter future foreign investment in US semis.
- Heavy-rare-earth (Dy/Tb/Sm) controls remain in place even after Nov 2025 truce — defense and EV-motor magnet supply still vulnerable.
- Enforcement aggression (Operation Gatekeeper, BIS budget +23%) increases compliance burden and creates litigation overhang for distributors / cloud providers.

## Sources
- [Congress.gov R48642: US Export Controls and China — Advanced Semiconductors](https://www.congress.gov/crs-product/R48642)
- [BIS: Rescission of AI Diffusion Rule (press release)](https://www.bis.gov/press-release/department-commerce-announces-rescission-biden-era-artificial-intelligence-diffusion-rule-strengthens)
- [WilmerHale: AI Diffusion Rule paused, new guidance elevates risk](https://www.wilmerhale.com/en/insights/client-alerts/20250515-us-export-controls-on-ai-diffusion-officially-paused-but-new-guidance-elevates-risk-for-ai-related-exports)
- [Willkie: BIS paves way for chip exports to China while privileging domestic investment (Jan 2026)](https://www.willkie.com/publications/2026/01/bis-paves-the-way-for-chip-exports-to-china-while-privileging-domestic-investment)
- [Baker McKenzie: BIS revises license review for advanced computing](https://sanctionsnews.bakermckenzie.com/bis-revises-license-review-policy-for-advanced-computing-commodities-ai-semiconductors-to-china-and-macau-when-exported-from-the-united-states/)
- [Pillsbury: China suspends export controls on critical minerals](https://www.pillsburylaw.com/en/news-and-insights/china-suspends-export-controls-certain-critical-minerals-related-items.html)
- [White & Case: China's extraterritorial 50% Rule for rare earths](https://www.whitecase.com/insight-alert/china-imposes-extraterritorial-jurisdiction-and-50-rule-export-controls-rare-earth)
- [Clark Hill: China hits pause on rare-earth export controls](https://www.clarkhill.com/news-events/news/china-hits-pause-on-rare-earth-export-controls-and-what-it-means-for-supply-chains/)
- [Andersen Institute: China's export-control architecture and pressure points](https://anderseninstitute.org/chinas-export-control-architecture-and-its-use-of-critical-minerals-as-strategic-pressure-points/)
- [SIA: 2025 State of the US Semiconductor Industry](https://www.semiconductors.org/wp-content/uploads/2025/07/SIA-State-of-the-Industry-Report-2025.pdf)
- [SIA/BCG: Emerging Resilience in the Semiconductor Supply Chain](https://www.semiconductors.org/emerging-resilience-in-the-semiconductor-supply-chain/)
- [Financial Content: CHIPS Act enters production era — Intel, TSMC, Samsung milestones](https://markets.financialcontent.com/wral/article/tokenring-2026-1-1-the-silicon-renaissance-us-chips-act-enters-production-era-as-intel-tsmc-and-samsung-hit-critical-milestones)
- [CNBC: Trump admin weighs 10% Intel stake via CHIPS](https://www.cnbc.com/2025/08/19/trump-administration-weighs-10percent-stake-in-intel-via-chip-act-grants.html)
- [CSIS: Too good to lose — America's stake in Intel](https://www.csis.org/analysis/too-good-lose-americas-stake-intel)
- [Investing.com: TSM trillion-dollar valuation and live geopolitical discount](https://www.investing.com/analysis/tsm-ais-core-foundry-trilliondollar-valuation-and-live-geopolitical-discount-200672078)
- [Simply Wall St: TSMC weighs Arizona packaging vs. delayed EUV investment](https://simplywall.st/stocks/us/semiconductors/nyse-tsm/taiwan-semiconductor-manufacturing/news/tsmc-weighs-arizona-packaging-expansion-against-delayed-next)
- [Simply Wall St: Apple expands Arizona orders, TSMC valuation premium](https://simplywall.st/stocks/us/semiconductors/nyse-tsm/taiwan-semiconductor-manufacturing/news/apple-orders-more-arizona-chips-as-tsmc-valuation-premium-dr)
- [Timewell: Full picture of semi export controls 2026 (Japan/MATCH Act)](https://timewell.jp/en/columns/semiconductor-export-regulation-2026)
- [Timewell: MATCH Act and what Japan must decide](https://timewell.jp/en/columns/semiconductor-export-control-japan-us-2026)
- [KDI: Impact of US export controls on Korean semiconductor exports](https://kdijep.org/v.46/3/1/The+Impact+of+US+Export+Controls+on+Korean+Semiconductor+Exports%E2%80%A0)
- [TechTimes: April rare-earth curbs still bite post-summit](https://www.techtimes.com/articles/317208/20260526/china-rare-earth-export-controls-april-curbs-still-bite-after-beijing-summit.htm)
- [ORF America: How China's rare-earth restrictions triggered diversification](https://orfamerica.org/orf-america-comments/chinas-rare-earth-export-restrictions-triggered-diversification)

---

## IPPs / merchant power

## Current state (May 2026)

Merchant power has been the biggest winner of the AI buildout, with Constellation, Vistra and Talen all locking in 17–20 year hyperscaler PPAs at premium pricing. PJM's 2025/2026 capacity auction at **$269.92/MW-day** — up ~9x from $28.92 — confirmed that capacity is structurally tight. Subsequent auctions hit the FERC cap: 2026/2027 = $329.17/MW-day, 2027/2028 = $333.44/MW-day. PJM's independent market monitor attributes 63% of the price jump (2025/26) and 40% of total auction cost (2027/28, ~$6.5B) to data centers.

**Constellation Energy (CEG)** — Crane Clean Energy Center / Three Mile Island Unit 1 restart deal with Microsoft is the template. 835 MW, 20-year PPA, 100% to Microsoft for PJM data centers (VA, OH, IL, PA). $1.6B investment + $1B DOE loan. License extension targeted through 2054. Original 2028 restart pulled forward to **2H 2027**. Stock jumped ~22% on the announcement. No co-location of MSFT DC on site; grid-tied via PJM. Constellation also has Vistra-style nuclear PPA discussions in PJM with other hyperscalers.

**Vistra (VST)** — 20-year, 1,200 MW Comanche Peak PPA with AWS — delivery starts late 2027, full capacity 2032, extendable 20 years. Meta deals across PJM nuclear (capacity, uprates, 20-year license renewals for all four nuclear units), plus 20-year Meta PPAs for >2,600 MW. **Cogentrix acquisition**: 5,500 MW of natural gas, closing mid-late 2026, follows the November 2025 Lotus 2,600 MW deal. New 860 MW gas at Permian Basin (tripling that footprint). 2026 guidance: $6.8–7.6B adj. EBITDA, $3.9–4.7B adj. FCF; reaffirmed 2027 midpoint $7.4–7.8B. Jefferies downgrade flagged delays in Comanche Peak structuring.

**Talen Energy (TLN)** — AWS deal restructured June 2025 from behind-the-meter (BTM, 300 MW colocated) to grid-connected (front-of-meter, FTM) at 1,920 MW over 17 years, ~$18B revenue, ~$1.4B/yr at full ramp with 2% annual escalators starting 2028. Transition takes effect spring 2026 during Susquehanna refueling outage; Talen becomes AWS's licensed retail provider in PA; PPL Electric delivers; generation enters PJM. PPA runs through 2042. **Cash impact**: projected after-tax cash flow per share +50% vs. 2026 guidance to >$8/share by 2030–2032; 20% CAGR from 2024. Stock ~$382, +79.8% TSR over the prior 12 months. Talen + Amazon exploring SMRs and Susquehanna uprates.

**FERC / PJM structural shift**: BTM colocation (Talen's original Susquehanna structure) was effectively blocked by FERC in 2024, forcing the FTM restructure. This is significant: hyperscalers can no longer fully bypass grid charges, raising the floor under capacity prices.

## Key catalysts

- Constellation TMI restart accelerated to 2H 2027 (vs. 2028) — earlier MSFT cash flow
- Vistra Cogentrix closing mid-late 2026 — 5.5 GW gas immediately accretive
- Talen FTM transition spring 2026 — start of $1.4B/yr revenue run-rate ramp
- PJM 2028/2029 BRA auction — likely third consecutive year at FERC cap
- Additional hyperscaler-IPP PPAs (Vistra–Meta uprates, CEG additional nuclear)
- Nuclear uprate filings — typically 1.5–6% per unit at far lower cost than greenfield

## Risks

- **Behind-the-meter regulatory uncertainty**: FERC's PJM decision against BTM colocation could be revisited under different admin; alternate FERC orders could change PPA economics
- **License extension dependency**: 20-year PPAs require NRC license renewals; renewal is routine but not guaranteed
- **Hyperscaler concentration**: TLN ~100% to AWS, CEG TMI 100% to MSFT — counterparty risk on AI capex cycle
- **PJM cap math**: FERC-approved cap at $329–333/MW-day already reached; further upside limited absent cap increase
- **Public/political backlash**: $9.3B PJM cost burden flowed to ratepayers, $21/mo bill increase for Pepco residential — risk of state-level legislative intervention ("data center cost allocation" rules)
- **Coal plant retirements vs. data center need**: timing mismatch could force load curtailment

## Sources

- [Constellation plans 2028 restart of TMI unit 1 (Utility Dive)](https://www.utilitydive.com/news/constellation-three-mile-island-nuclear-power-plant-microsoft-data-center-ppa/727652/)
- [DOE loans Constellation $1B to restart TMI (Utility Dive)](https://www.utilitydive.com/news/doe-loan-constellation-crane-nuclear-restart/805923/)
- [Vistra long-term Comanche Peak nuclear PPA (Power Engineering)](https://www.power-eng.com/nuclear/vistra-secures-long-term-nuclear-ppa-from-comanche-peak-nuclear-plant/)
- [Vistra in Talks to Expand Power for Data Centers (POWER)](https://www.powermag.com/vistra-in-talks-to-expand-power-for-data-centers-through-nuclear-gas-options/)
- [Talen, Amazon Launch $18B Nuclear PPA (POWER)](https://www.powermag.com/talen-amazon-launch-18b-nuclear-ppa-a-grid-connected-ipp-model-for-the-data-center-era/)
- [Talen Expands Nuclear Energy Relationship with Amazon (Talen IR)](https://ir.talenenergy.com/news-releases/news-release-details/talen-energy-expands-nuclear-energy-relationship-amazon)
- [Projected data center growth spurs PJM capacity prices by factor of 10 (IEEFA)](https://ieefa.org/resources/projected-data-center-growth-spurs-pjm-capacity-prices-factor-10)
- [PJM 2026/2027 BRA Report (PJM)](https://www.pjm.com/-/media/DotCom/markets-ops/rpm/rpm-auction-info/2026-2027/2026-2027-bra-report.pdf)
- [Data centers were 40% of PJM capacity costs in last auction (Utility Dive)](https://www.utilitydive.com/news/data-centers-pjm-capacity-auction/808951/)
- [PJM Capacity Auction Hits Record $329/MW-Day (IGS)](https://www.igs.com/energy-resource-center/energy-101/capacity-auction-results--what-it-means-for-your-business-s-electric-bill)

---

## Astera Labs (ALAB) — scale-up fabric

## Why this is its own node (May 2026)
Astera Labs was hiding inside the "optical interconnect" node, but the
research shows it's a structurally distinct story: PCIe/CXL retimers +
the **Scorpio X-Series 320-lane scale-up fabric**, which is now expected
to be Astera's largest product line by exit FY26.

## Current state
- Q1 FY26 revenue **$308M (+93% YoY)**.
- Scorpio X is purpose-built for AI scale-up (rack-internal GPU↔GPU)
  vs. Spectrum-X / Quantum at scale-out.
- CPO (co-packaged optics) targeted FY28.
- Aries (PCIe retimers) still the cash cow — every modern AI server
  has multiples of these.

## Strategic position
- Plays where NVDA's NVLink ends and Ethernet/InfiniBand begins.
- Direct beneficiary of GB300 / Vera Rubin 600 kW racks where signal
  integrity becomes the limit.
- Effectively a "Broadcom-adjacent" picks-&-shovels name without the
  custom-ASIC margin profile.

## Risks
- Single product family concentration.
- NVDA's NVLink Fusion + custom retimer push could compress TAM.
- High valuation multiple — any guide-down is brutal.

## Sources
Pulled forward from Networking agent (Coherent/Lumentum/Astera) and
Memory agent (CXL memory pooling cross-cut).

---

## AI neoclouds — CoreWeave, Crusoe, Lambda

## Why this is its own node
A new compute-rental layer parallel to hyperscalers. They buy GPUs
in bulk, rent them out by the hour, win contracts hyperscalers can't
serve (faster procurement, no AWS lock-in). Now structurally large.

## Current state (May 2026)
- **CoreWeave (CRWV)**: Q1 26 rev **$2.078B (2x YoY)**, **$100B backlog**,
  1+ GW active capacity, $8.5B + $3.1B DDTL facilities. Anthropic
  reportedly took all of xAI's Colossus 1 from CoreWeave in May 2026 —
  the first clear AI overbuild signal.
- **Crusoe**: ~$10B valuation post-Series E, ~$2B FY26E revenue,
  OpenAI Stargate Abilene developer.
- **Lambda**: Hired MS / JPM / Citi for **H1 2026 IPO**.
- Plus Nebius (NBIS, ex-Yandex), Vast Data, Together AI.

## Strategic position
- Demand sink for NVDA / AMD GPUs alongside hyperscalers.
- Customers: AI labs that don't want to be on the big-three clouds,
  enterprises wanting dedicated GPU clusters.
- Land + power siting agility their main edge — picking sites
  hyperscalers don't want.

## Risks
- Margin compression as hyperscalers' own capacity catches up.
- Single-customer concentration (CoreWeave: MSFT was >60% in 2024).
- Debt-funded GPU buildouts — sensitive to NVDA depreciation curve.
- The Anthropic-takes-Colossus signal: when AI labs trade clusters
  between neoclouds, supply has caught demand.

## Sources
Datacenter agent + Demand agent — both flagged this category.

---

## Enterprise AI servers — Dell, SMCI, HPE

## Why this is its own node
The on-prem AI buildout. Dell + SMCI + HPE are the actual assemblers
shipping NVDA HGX/DGX systems to sovereign, enterprise, and neocloud
buyers. Big enough now to track separately from the hyperscaler demand
node.

## Current state (May 2026)
- **Dell (DELL)**: ISG **$60.8B FY26 (+40%)**, AI server **$9B Q4
  (+342%)**, FY27 target $50B AI server revenue. PowerEdge XE9712
  GB300 racks shipping.
- **Super Micro (SMCI)**: Q2 FY26 **$12.7B (+123%), 90% AI**. Liquid-cooled
  rack-scale GB300 leader. Lingering accounting-restatement overhang
  cleared in late 2025.
- **HPE**: GreenLake + Juniper integration; AI server revenue +18%;
  Cray heritage on sovereign deals.
- Smaller: Penguin Solutions, Cisco UCS X-Series.

## Customers
Sovereigns (UAE G42, Saudi HUMAIN, India L&T/Yotta), neoclouds,
Fortune 500 on-prem (financial services, biotech), DOE labs.

## Strategic position
- Margin-thin assemblers — they get the volume but NVDA gets the
  margin. Dell + SMCI gross margins in the 11–15% range.
- Lead time is the moat — Dell can ship 2x faster than HPE.
- Liquid cooling capability the new wedge (favors SMCI).

## Risks
- Hyperscaler vertical integration squeezes them out at the high end.
- Margin compression as GB200/300 supply normalizes.
- Component supply tightness (HBM, transceivers) cuts both ways.

## Sources
Demand agent — Dell ISG / SMCI / HPE figures.

---

## HBF (High Bandwidth Flash) — emerging

## Why this is its own node
HBF crosses two pieces (Memory + storage). It's a new category — NAND
flash stacked in HBM form factor for AI inference workloads where
capacity matters more than HBM3e bandwidth.

## Current state (May 2026)
- **Sandisk + SK Hynix HBF partnership**, OCP-standardized.
- Target: **8–16× HBM capacity at similar cost** for inference.
- First samples shipping **2H 2026**.
- Driver: model context windows + KV-cache size, where DRAM bandwidth
  is overkill but capacity is the binding constraint.

## Strategic position
- If real, this changes the inference-vs-training silicon split.
- Plays into the broader "inference is where the volume goes" thesis.
- Benefits NAND makers (Sandisk, Kioxia, Solidigm) more than DRAM.

## Risks
- First-gen will have bandwidth and latency tradeoffs vs HBM.
- NVDA + AMD must qualify it on their AI accelerators.
- HBM4e capacity scaling may keep DRAM competitive on $/TB.

## Sources
Memory agent flagged this as a cross-cutting M1+M4 node.

---

## HALEU + enrichment — Centrus, URENCO

## Why this is its own node
Even with uranium mined, the enrichment bottleneck gates SMR deployment.
HALEU (high-assay low-enriched uranium, 5–20% U-235) is what most new
SMR designs need, and Western supply is severely constrained.

## Current state (May 2026)
- **Centrus Energy (LEU)**: Delivered **900 kg HALEU**; got **$900M DOE
  expansion task order Jan 2026**. Only US enricher of HALEU.
- **URENCO**: European enrichment, exploring US HALEU expansion.
- **Russia**: Historically supplied ~20% of US enriched uranium —
  banned by Prohibiting Russian Uranium Imports Act 2024, with waivers
  expiring 2028. HALEU was Russia-only at scale until Centrus.

## Strategic position
- Centrus is a near-monopoly on Western HALEU until 2028+.
- DOE acceleration funding tied to SMR deployment timelines.
- Without HALEU, the X-energy / TerraPower / Oklo customer pipelines
  can't actually load fuel.

## Risks
- New entrants (X-energy is exploring its own enrichment).
- Russian HALEU waivers lifted = supply shock relief but Russia trust.
- Centrus is a tiny single-product company with execution risk.

## Sources
Energy agent — flagged as separate node from uranium mining.

---

## Grid construction labor — Quanta, MasTec

## Why this is its own node
Transformer + turbine supply is one constraint; the actual labor that
installs them is the other. Specialized union electricians, switchyard
crews, HVDC technicians — the workforce takes years to scale.

## Current state (May 2026)
- **Quanta Services (PWR)**: Backlog **$48.5B**, 60K workforce.
- **MasTec (MTZ)**: Q1 2026 record backlog **$20.3B**, ~$1B data
  center work.
- Sub-sector: Quanta + MasTec do transmission, substations,
  utility-scale renewables, DC connections.
- Customers: utilities, IPPs (E3), hyperscalers building direct
  interconnects.

## Strategic position
- Long-cycle, multi-year contracts with margin protection.
- Labor moat is real — can't import grid technicians on H-1Bs.
- Beneficiary of every grid expansion thesis on this graph.

## Risks
- Margin pressure if labor wage inflation runs ahead of escalators.
- Project delays / cost overruns historically common in transmission.
- Permitting delays (FERC, BLM, state PUCs) cap upside even if labor
  is available.

## Sources
Energy agent — separate node from transformer suppliers (E5).

---

## OSAT + advanced packaging

## Why this is its own node
The bottleneck has shifted from logic transistors to packaging
connectivity (CoWoS, SoIC, EMIB, FoPLP). TSMC does its own advanced
packaging, but the broader OSAT industry (Outsourced Assembly + Test)
plays a critical role and is geographically concentrated in
Taiwan + Korea.

## Current state (May 2026)
- **ASE Technology (ASX)**: Taiwan OSAT leader; advanced packaging
  exposure growing.
- **Amkor (AMKR)**: US-listed OSAT, Arizona facility planned.
- **TSMC CoWoS**: ~13K wpm (end-2023) → ~75K wpm (end-2025) →
  ~130K wpm (end-2026). NVDA holds >50% allocation through 2026.
- **KLA** (in F3) took #1 advanced packaging share with **+70% YoY
  revenue**.
- Adv. packaging equipment market: ~$13B in 2026 (+30% YoY).

## Strategic position
- Every AI chip — Blackwell, Rubin, MI400, TPU v7, Trainium 3, Maia,
  MTIA — passes through advanced packaging. Capacity is the hard
  binding constraint, not lithography.
- KLA / AMAT / LRCX advanced packaging tool sales are the
  highest-growth line in semicap.

## Risks
- Taiwan concentration (geopolitics → S3) hits CoWoS hardest.
- Amkor / ASE diversification slow — multi-year buildout.
- Yield issues in advanced packaging are still the dominant cause of
  AI chip shortages.

## Sources
Mfg agent (KLA findings) + Supply agent flagged OSAT as a missing
node.

---

## Sovereign wealth — MGX, PIF, Mubadala

## Why this is its own node
A new marginal LP layer underwriting AI capex. Not buyers themselves
in the simple sense — funders of hyperscalers, neoclouds, AI labs,
and direct DC buildouts. Without these checks, Stargate doesn't exist.

## Current state (May 2026)
- **MGX (UAE)**: Funded by Mubadala, backing AI infrastructure
  globally. Stargate co-investor.
- **PIF (Saudi)**: Backs HUMAIN; ~$23B announced AI partnerships;
  600K GB300 over 3 yrs target.
- **Mubadala (UAE)**: AI infrastructure stakes.
- **SoftBank**: Stargate's lead LP alongside Oracle. Vision Fund 2
  + direct DC investments.
- **GIC + Temasek (Singapore)**: Quieter, mostly co-invests.

## Strategic position
- Pricing power on capex deals — they can write checks hyperscalers
  alone can't.
- Geopolitical alignment becomes a feature (UAE / Saudi US-aligned).
- Funds whatever returns capital — that's everything on this graph
  with positive EVA.

## Risks
- Oil price drop → PIF / MGX retrench.
- Geopolitical alignment shifts (Saudi-China deepening).
- Concentration risk: if any one project (Stargate) goes bad, LP
  appetite cools fast.

## Sources
Demand agent flagged this as a structural new layer of the stack.

---

## Inference chips — Groq, Cerebras, etc.

## Current state (May 2026)

The non-NVDA inference-specialist tier has consolidated and gone public/quasi-public in the past six months. **Cerebras** IPO'd on Nasdaq 14 May 2026 (ticker CBRS), pricing at $185, opening at $350, ending IPO week at ~$60B market cap — the largest US tech IPO since Uber. $5.55B raised on a $24.6B end-of-2025 revenue backlog, anchored by a $20B Master Relationship Agreement with OpenAI for 750 MW of inference capacity and a March 2026 AWS deal pairing Trainium (prefill) with CS-3 (decode) on Bedrock. 2025 revenue $510M (+76% YoY) but ~86% concentrated in two UAE entities (G42). Wafer Scale Engine 3 delivers >2,200 tok/s on GPT-OSS 120B and 21 PB/s on-chip memory bandwidth (~1000x Rubin); core thesis is that inference is memory-movement-bound, not compute-bound.

**Groq** is the most disrupted story: in Dec 2025 NVIDIA agreed to buy Groq IP/assets for ~$20B via a non-exclusive license + acquihire, the largest deal in NVDA's history. GroqCloud survives as an independent entity under new CEO Simon Edwards to service existing contracts — most importantly the Feb 2025 $1.5B Saudi LEAP commitment (19,000+ LPUs in Dammam, dedicated to inference, hosting ALLaM Arabic LLM). Groq tokenomics remain the benchmark: 5–10 cents per million tokens vs ~25 cents on NVDA B200, with 750 tok/s on Llama 4 70B decode vs 100–150 on H100. The NVDA acquisition effectively closes the architectural gap by absorbing the SRAM-heavy LPU IP into Rubin's successor roadmap.

**SambaNova** raised $350M Series E in Feb 2026 with Intel Capital as anchor (after Intel reportedly considered an outright $1.6B acquisition in Dec 2025). New SN50 RDU ships H2 2026: 5x compute vs SN40, 256-accelerator scale-out fabric at multi-Tb/s, 64 GB HBM + 432 MB SRAM + up to 2 TB DDR5 tiered memory — explicitly architected for hot-swapping models in agentic workloads. Joint April 2026 Intel/SambaNova reference blueprint uses Xeon 6 for orchestration, GPUs/RDUs for prefill, SN50 for decode. SambaNova reports 378 tok/s on MiniMax M2 (230B). CEO Liang says strategy is selling infrastructure, not building a Groq-style neocloud.

**Etched** raised $500M at a $5B valuation (total $620M, Stripes + Peter Thiel) to push Sohu, the transformer-only ASIC: 144 GB HBM3E, claimed 90%+ FLOPS utilization, 500K tok/s on Llama 70B with 8 chips vs ~23K on 8x H100 and ~45K on 8x B200. As of March/April 2026 Sohu is not yet in customer hands, no third-party benchmarks exist, and it is structurally incompatible with MoE models (DeepSeek V4, Qwen3-235B-A22B) — a significant fraction of current production inference.

**Tenstorrent** under Jim Keller closed/closing $800M at $3.2B pre led by Fidelity (Nov 2025), with takeover conversations reported with both Intel and Qualcomm. Pivoting from chip-maker to Arm-replacement IP licensor: Ascalon-X RISC-V (8-wide OoO, ~21 SPECint2006/GHz, RVA23) + Tensix AI cores. Galaxy Blackhole reached GA April 28, 2026; deployments in Japan (LSTC sovereign), Cyprus, UAE (Infinia), India (Turiyam — sovereign AI / image-as-a-service), with Smallest.ai TTS on Tenstorrent claiming 3.6x lower infra cost than GPUs. Tenstorrent is the credible non-Arm CPU IP play.

**Rebellions** (Korea) completed the Sapeon merger Dec 2024, raised $400M pre-IPO in early 2026 at $2.34B (total ~$850M), with Samsung, SK Hynix, Arm, and Saudi Aramco on the cap table; Korea National Growth Fund has designated it the 'K-Nvidia.' Rebel100 NPU plus RebelRack/RebelPOD systems; IPO planned for later 2026.

## Strategic position

These chips are not training competitors — they are decode-stage specialists exploiting the architectural insight that inference (especially long-context, agentic, streaming) is memory-bandwidth- and latency-bound rather than FLOPS-bound. The economic case is now proven: $0.05–$0.10/M tokens on Groq/Cerebras vs $0.25/M on B200 at 5–10x throughput on latency-sensitive workloads. Inference is ~90–95% of enterprise AI demand per Nebius, which is what made the Cerebras IPO and NVDA-Groq deal possible.

The pattern is convergence by acquisition or IPO: NVDA bought Groq's IP, Intel anchored SambaNova's round, Cerebras is public. Tenstorrent is the next likely Intel/Qualcomm target. Sovereign AI is the demand-side moat — Saudi (Groq, SambaNova), UAE (Cerebras G42), Japan (Tenstorrent LSTC), Korea (Rebellions), India (Tenstorrent/Turiyam), Cyprus — buyers who explicitly do not want to depend on NVDA-aligned supply chains.

Hybrid architectures are becoming the default: AWS pairs Trainium (prefill) + Cerebras (decode); Intel/SambaNova pairs Xeon (orchestration) + GPU (prefill) + RDU (decode). This validates the I1 thesis but also means these chips slot beside, not instead of, NVDA in most deployments.

## Risks

- Customer concentration is extreme. Cerebras: 86% of 2025 revenue from two UAE entities (G42). Groq: Saudi is the load-bearing contract. Etched: zero shipped customers as of April 2026. SambaNova: Intel as both investor and channel.
- NVDA can replicate the SRAM-heavy/memory-bound architecture organically post-Groq acquisition; the Rubin-plus-Groq-IP roadmap could close the 5–10x throughput gap by 2027.
- Architecture risk is binary for transformer-only ASICs (Etched): if MoE keeps gaining share or a non-transformer dominant architecture emerges, the silicon is stranded. Already incompatible with DeepSeek V4 and Qwen3-235B-A22B.
- HBM allocation is the chokepoint. NVDA Rubin will absorb Micron/Samsung/Hynix HBM4 output; Etched, Cerebras, SambaNova compete for HBM3E supply with limited leverage.
- Cerebras at IPO is overdue for a refresh (WSE-3 architecture lead is shrinking), priced for perfection, and faces an SRAM-equipped NVDA via Groq IP.
- Hailo (edge-adjacent inference) is doing a SPAC at <$500M valuation, down from $1.2B in 2024, after layoffs and a $9M loan — signal that the inference-chip mid-tier outside hyperscaler deals is under stress.
- Sovereign deals carry geopolitical/export-control reversal risk (G42 review delayed Cerebras' first IPO).

## Cross-cutting

- This node directly couples to memory (HBM allocation), datacenter (GW-scale sovereign builds in Saudi/UAE/Korea), and energy (Cerebras 750 MW OpenAI commitment alone is a small-country power footprint).
- The Tenstorrent IP-licensing pivot collides with the existing ARM node — Ascalon-X is positioned as a Neoverse V3 replacement, materially worsening ARM's data-center upside if it lands.
- NVDA's Groq acquisition implies the I1 thesis is now partly priced into NVDA itself; the 'non-NVDA inference' framing weakens unless Cerebras/SambaNova/Tenstorrent retain independent architectural leads through 2027.
- Sovereign AI is the most durable cross-cutting demand vector and probably deserves its own node.

## Sources

- [Saudi Arabia Announces $1.5B Expansion with Groq](https://groq.com/blog/saudi-arabia-announces-1-5-billion-expansion-to-fuel-ai-powered-economy-with-groq)
- [Groq secures $1.5bn from Saudi Arabia (DCD)](https://www.datacenterdynamics.com/en/news/groq-secures-15bn-from-saudi-arabia-to-expand-ai-inference-infrastructure-in-the-region/)
- [NVIDIA's $20B Strategic Integration of Groq](https://markets.financialcontent.com/stocks/article/marketminute-2025-12-25-nvidias-20-billion-strategic-integration-of-groq-a-new-era-for-ai-inference)
- [Cerebras wafer-scale IPO (The Register)](https://www.theregister.com/ai-ml/2026/05/15/cerebras-wafer-scale-ai-bet-delivers-blockbuster-ipo/5240821)
- [Cerebras S-1 April 2026 (SEC)](https://www.sec.gov/Archives/edgar/data/2021728/000162828026025762/cerebras-sx1april2026.htm)
- [Cerebras S-1 Teardown (Futurum)](https://futurumgroup.com/insights/cerebras-s-1-teardown-is-the-23b-wafer-scale-ipo-the-end-of-gpu-homogeneity/)
- [OpenAI's cozy partner Cerebras (TechCrunch)](https://techcrunch.com/2026/05/04/openais-cozy-partner-cerebras-is-on-track-for-a-blockbuster-ipo/)
- [SambaNova raises $350M with Intel backing (Register)](https://www.theregister.com/2026/02/24/sambanova_intel_funding/)
- [SambaNova SN50 RDU launch](https://sambanova.ai/blog/introducing-the-sn50-rdu-purpose-built-for-agentic-inference)
- [SambaNova/Intel inference blueprint (HPCwire)](https://www.hpcwire.com/2026/04/09/sambanova-and-intel-in-latest-ai-inference-chip-tie-up/)
- [Etched's $500M Sohu chip (AI World)](https://theaiworld.org/news/etcheds-500m-sohu-chip-takes-aim-at-nvidia)
- [Sohu vs Nvidia for transformer inference (Spheron)](https://www.spheron.network/blog/etched-ai-sohu-vs-nvidia-transformer-asic-inference/)
- [Tenstorrent Ascalon RISC-V IP launch](https://markets.financialcontent.com/wral/article/tokenring-2025-12-25-the-arm-killer-jim-kellers-tenstorrent-unleashes-ascalon-risc-v-ip-to-disrupt-the-data-center)
- [Intel and Qualcomm circle Tenstorrent (TNW)](https://thenextweb.com/news/tenstorrent-intel-qualcomm-takeover-jim-keller-risc-v)
- [Tenstorrent Galaxy Blackhole GA (Futurum)](https://futurumgroup.com/insights/tenstorrents-galaxy-blackhole-can-risc-v-processors-expand-fast-inference-globally/)
- [Smallest.ai + Tenstorrent India partnership](https://www.aninews.in/news/business/smallestai-and-tenstorrent-partnership-democratises-voice-ai-4x-reduction-in-cost-through-hardware-acceleration20260511114316/)
- [Rebellions $400M pre-IPO round](https://theaiworld.org/news/rebellions-raises-400m-pre-ipo-ai-funding-round)
- [Rebellions-Sapeon merger complete](https://rebellions.ai/newsroom/rebellions-and-sapeon-korea-complete-merger-launching-koreas-first-ai-chip-unicorn/)
- [Groq Blackwell tokens-per-dollar comparison (wccftech)](https://wccftech.com/nvidias-ai-chips-see-alternatives-emerge-amidst-pricing-model-shift-to-cost-per-million-tokens/)
- [Inference economics cost-per-token model (SoftwareSeni)](https://www.softwareseni.com/inference-economics-how-to-model-the-true-cost-per-token-across-gpu-architectures/)
- [AI Inference Providers Q2 2026 Pricing (Digital Applied)](https://www.digitalapplied.com/blog/ai-inference-providers-pricing-matrix-q2-2026)

---

## Edge inference — Apple, Qualcomm, MediaTek

## Current state (May 2026)

Edge inference in 2026 is being defined by a co-evolution of NPUs, on-device LLMs, and ARM IP redesigned around AI from the ground up — a fundamentally different supply chain from the data-center side.

**Apple M5** shipped Oct 2025 on TSMC N3P (3rd-gen 3 nm): 16-core Neural Engine plus a Neural Accelerator inside each of the 10 GPU cores, >4x peak GPU compute vs M4, and unified memory bandwidth up 30% to 153 GB/s (M5 Pro 307 GB/s, M5 Max up to 614 GB/s for 40-core GPU). Apple claims 4x faster LLM prompt processing M5 Pro/Max vs M4 Pro/Max. The full Apple Intelligence stack ('Siri 2.0') ships with macOS 17.4 / iOS 26.5 in spring 2026, with the conversational experience in iOS 27 in September. Apple's ~3B-parameter on-device foundation model outperforms Phi-3-mini, Mistral-7B, Gemma-7B, and Llama-3-8B on human-grader benchmarks. Notable strategic shift: Apple signed a multi-year deal with Google in early 2026 to use Gemini for cloud / model distillation — Siri uses Apple Foundation Models v10 (a 1.2T-parameter model routed through Private Cloud Compute) but distilled from Gemini. **M6 on TSMC N2 with backside power delivery is targeted for late 2026 / 2027**, paired with the first OLED MacBook Pro redesign since 2021.

**Qualcomm Snapdragon X2 Elite / X2 Elite Extreme** launched at CES 2026 — the first widely shipping 85 TOPS NPU laptop chip, with 18 Oryon cores (12 prime + 6 perf), 5.0 GHz boost (first for Arm Windows), and a dedicated NPU power rail enabling background AI (Snapdragon Guardian, live translation) with negligible battery drain. Qualcomm claims 40–50% perf/watt lead over Intel Panther Lake in ultra-portables. Mobile flagship rebranded to **Snapdragon 8 Elite** (formerly '8 Gen 4') on TSMC N3E, and the newer **Snapdragon 8 Elite Gen 5** Hexagon NPU runs 56+ models in <5 ms; FastVLM on Gen 5 delivers 0.12 s TTFT on 1024x1024 images, >11,000 tok/s prefill, >100 tok/s decode. Snapdragon Wear Elite at MWC 2026 puts a Hexagon NPU running up to 2B-param models in wearables, with an eNPU low-power island for always-on tasks.

**MediaTek Dimensity 9500** (Sep 2025) ships in OPPO Find X9 and Vivo flagships with the NPU 990 — first dual-NPU smartphone architecture — plus a 3rd-gen All-Big-Core CPU using Armv9.3 with SME2 (1x C1-Ultra @ 4.21 GHz, 3x C1-Premium @ 3.5 GHz, 4x C1-Pro @ 2.7 GHz), 32% single-core / 17% multi-core gain over D9400, 55% lower peak power. **Dimensity 9500s** launched Jan 15, 2026 on 3 nm with a 19 MB cache, 42% lower power on AI tasks vs prior gen. MediaTek positions the chip for agentic AI: real-time outpainting, object removal, multimodal call/meeting summarization on-device. US flagship is still Qualcomm-locked but D9500 is competitive in EMEA and Asia.

**ARM Lumex CSS** (Sep 2025) is the platform unifying the above: Armv9.3 C1 cluster (Ultra/Premium/Pro/Nano) with built-in **SME2** matrix extensions, Mali G1-Ultra GPU (20% faster AI inference), and SI L1 system interconnect with 71% leakage reduction in system-level cache. Arm projects SME/SME2 across >3B devices delivering >10B TOPS by 2030. KleidiAI is now integrated into PyTorch ExecuTorch, Google LiteRT, Alibaba MNN, and Microsoft ONNX Runtime — apps get SME2 acceleration with zero code changes. Apple, Samsung, MediaTek, and Qualcomm are all SME2-aligned, making Lumex the single most consequential IP release in mobile AI this cycle.

**Hailo** (discrete edge accelerator) shipped Hailo-10H GA in mid-2025: 2.5 W, 40 TOPS INT4, sub-second first-token and >10 tok/s on 2B-param models, AEC-Q100 Grade 2, targeted for automotive cockpit/DMS production in 2026. But Hailo is reportedly going public via SPAC at <$500M valuation (down from $1.2B in 2024) after a January 2026 layoff and a $9M emergency loan — the bellwether for stress in the standalone edge-AI silicon tier.

**On-device LLMs** are converging on a 'SLM-first hybrid' pattern. Gemini Nano v3 ships on a narrow set of 2026 flagships (Snapdragon 8 Elite, Snapdragon 8 Gen 4-equivalent, Tensor G5/Pixel 10) via Android AICore, gated on '5+ Android OS updates' guarantees. Apple Intelligence requires 8 GB RAM (vs 12 GB on equivalent Android), distilled-from-Gemini under the new deal. Microsoft Phi-3 remains the open-source SLM benchmark. Latency advantage is concrete: sub-100 ms TTFT on-device vs 500 ms–2 s for cloud LLMs.

**Enterprise edge** is at a real inflection: Grand View projects $24.9B (2025) → $118.7B (2033) at 21.7% CAGR; Gartner says 50% of compute at the edge by 2029. NVIDIA RTX Pro 4500 (Mar 2026 GTC) explicitly targets factory floors, hospital imaging, and retail back offices at half the power of the RTX 6000. Cisco/Dell/HPE/NVIDIA are pushing inference into RAN with AT&T and T-Mobile. Real deployments: car-wash chains running conversational LLMs + computer vision at hundreds of locations scaling to 10,000; manufacturing vision systems at 1,000+ items/min; automotive electronics reporting 90% energy reductions on NPU-based inference vs GPU.

## Strategic position

The edge inference supply chain is a fundamentally different stack from data center: TSMC N3/N3P/N3E (not N3 + CoWoS), no HBM (LPDDR5X / unified memory), ARM IP at the core (not x86), and OS-level model distribution (AICore, Foundation Models framework) rather than CUDA. This makes the edge a structural hedge against any single data-center bottleneck — HBM allocation, CoWoS packaging, or NVDA's CUDA moat.

The defining 2026 fact is that the SLM-quality bar has been crossed: a ~3B-param on-device model now beats 7–8B cloud models on human benchmarks, and SME2 plus per-GPU-core neural accelerators have made local LLM inference fast enough (>100 tok/s) for streaming chat UX. Once that's true on every flagship phone and PC sold, a meaningful fraction of inference demand never reaches a hyperscaler. Apple's distill-from-Gemini deal is a tacit admission that the on-device tier can absorb a generation of frontier capability via distillation.

Qualcomm has clearly won the AI-PC narrative (X2 Elite vs Panther Lake / Strix Halo) on perf/watt. Apple owns the integrated stack (silicon + OS + frameworks + distribution). MediaTek leads in Asia/EMEA volume. Arm has positioned Lumex CSS such that everyone above is paying it more rent per device than ever before — the Tenstorrent Ascalon-X threat is real but multi-year. Hailo's distress shows that standalone discrete edge silicon outside the SoC integrators is hard to sustain.

Enterprise edge is the genuinely new growth vector: 200–500 node fleets per industrial customer, 20,000+ device deployments where unit cost and watts dominate. This is where NVDA (RTX Pro 4500, Thor), Qualcomm, AMD, and the NPU-everywhere thesis collide — and where ARM Lumex's '10B+ TOPS by 2030' projection actually plays out.

## Risks

- Apple's Gemini-distillation dependency creates a strategic vulnerability: the on-device Apple Foundation Model is downstream of Google's frontier roadmap, which could be repriced or revoked.
- Qualcomm's AI-PC lead depends on Arm-on-Windows software parity; Intel Panther Lake + Microsoft co-engineering could close the perf/watt gap in 2027.
- Hailo's SPAC at <$500M signals weakness for discrete edge silicon that isn't bundled with a phone/PC SoC; same risk applies to other standalone edge accelerator startups not surveyed here.
- SME2 adoption requires the whole stack (LLVM, PyTorch, ONNX, model zoos) to recompile/retune — KleidiAI integration is the gating dependency and could fragment.
- The 'on-device is good enough' thesis is dependent on continued SLM quality gains via distillation; if frontier model gains accelerate beyond what 3–8B distilled models can carry, edge keeps losing share to cloud.
- Enterprise edge deployments at scale (20K+ nodes) put NPU-supplier dependency on the customer's CAPEX cycle; lock-in risk is real but counterbalanced by ONNX/LiteRT portability.
- MediaTek's US share remains capped by carrier/OEM relationships regardless of Dimensity 9500's spec parity with Snapdragon.

## Cross-cutting

- This node is structurally entangled with the ARM node: Lumex CSS / SME2 is the single biggest IP event in mobile AI in 2026, and Tenstorrent's Ascalon-X RISC-V threat (from I1) is the most credible long-term displacement vector for ARM's data-center upside but does not yet threaten ARM in mobile/PC edge.
- Supply chain is decoupled from the HBM/CoWoS chokepoints that constrain the data-center accelerators — edge demand is N3-family wafer demand, not packaging-limited.
- The Apple-Google deal couples edge silicon to cloud LLM economics: Apple Foundation Models v10 distilled from Gemini is the first formal acknowledgement that edge models are downstream of frontier cloud training runs.
- TSMC N2 (Apple M6) and backside power delivery are the cross-cutting node-shrink dependency shared with NVDA Rubin successors — competition for N2 capacity is the supply-side risk to watch in 2027.
- Enterprise edge ('car-wash chain', 'factory floor', 'retail back office') is large and underweighted in current graph framing and probably deserves a dedicated node.

## Sources

- [Apple unleashes M5 (Apple Newsroom)](https://www.apple.com/newsroom/2025/10/apple-unleashes-m5-the-next-big-leap-in-ai-performance-for-apple-silicon/)
- [Apple M5 (Wikipedia)](https://en.wikipedia.org/wiki/Apple_M5)
- [Apple M5 Roadmap 2026 AI Silicon Offensive](https://www.financialcontent.com/article/tokenring-2026-1-7-apples-m5-roadmap-revealed-the-2026-ai-silicon-offensive-to-reclaim-the-pc-throne)
- [Apple Foundation Models intro (Apple ML Research)](https://machinelearning.apple.com/research/introducing-apple-foundation-models)
- [Apple-Google Gemini deal (AppleInsider)](https://appleinsider.com/articles/26/01/12/google-gemini-tech-will-be-used-in-the-all-new-siri-after-major-apple-ai-deal)
- [Snapdragon X2 Elite 85 TOPS at CES 2026](https://markets.financialcontent.com/stocks/article/tokenring-2026-2-5-the-85-tops-revolution-qualcomms-snapdragon-x2-elite-redefines-the-ai-pc-era-at-ces-2026)
- [Qualcomm Snapdragon 8 Elite Guide (April 2026)](https://www.androidheadlines.com/qualcomm-snapdragon-8-elite)
- [Qualcomm NPU LiteRT performance (Google Devs)](https://developers.googleblog.com/unlocking-peak-performance-on-qualcomm-npu-with-litert/)
- [Snapdragon Wear Elite for wearables (Android Central)](https://www.androidcentral.com/phones/qualcomm/qualcomm-unveils-snapdragon-wear-elite)
- [MediaTek Dimensity 9500 announcement](https://www.mediatek.com/dimensity-9500)
- [Dimensity 9500 dual-core NPU (DIGITIMES)](https://www.digitimes.com/news/a20250922PD233/mediatek-dimensity-performance-npu-dual-core.html)
- [MediaTek Dimensity 9500s deep dive (Cyber Raiden)](https://cyberraiden.wordpress.com/2026/03/05/mediatek-dimensity-9500s/)
- [Arm Lumex CSS platform announcement](https://newsroom.arm.com/news/announcing-lumex-css-platform-ai-era)
- [Arm Lumex CSS overview (Arm)](https://www.arm.com/products/mobile/compute-subsystems/lumex)
- [Arm Lumex CSS for on-device AI (Futurum)](https://futurumgroup.com/insights/arms-lumex-css-aims-to-accelerate-on-device-ai-innovation/)
- [Hailo-10H GA launch (SiliconANGLE)](https://siliconangle.com/2025/07/22/hailo-launches-hailo-10h-chip-support-generative-ai-edge/)
- [Hailo SPAC merger report (SiliconANGLE)](https://siliconangle.com/2026/04/03/report-edge-ai-chip-startup-hailo-go-public-via-spac-merger/)
- [Gemini Nano on-device guide 2026](https://devin-rosario.medium.com/implementing-on-device-slms-a-2026-guide-to-gemini-nano-911da096a471)
- [Gemini-powered Siri (AI2Work)](https://ai2.work/blog/apple-s-gemini-powered-siri-is-here-and-it-s-changing-everything)
- [Edge AI infrastructure inflection (SiliconANGLE GTC 2026)](https://siliconangle.com/2026/03/20/edge-ai-infrastructure-reaches-real-world-inflection-point-nvidiagtcai/)
- [2026 Predictions edge AI industrial (ZEDEDA)](https://zededa.com/blog/2026-predictions-how-edge-ai-is-reshaping-industrial-operations/)
- [Edge AI in manufacturing trends (TechAhead)](https://www.techaheadcorp.com/blog/edge-ai-in-manufacturing-trends/)

---

## Robotics / physical AI

## Current state (May 2026)

**Figure AI ($39B):** Series C closed Sep 2025 at $39B post-money (15x jump from $2.6B in Feb 2024). Investors include Brookfield, Intel, NVIDIA, Qualcomm, Salesforce, T-Mobile, Microsoft, OpenAI, Bezos. BMW Spartanburg pilot wrapped Nov 2025 after 11 months on Figure 02 (30,000+ vehicles, 90,000+ parts, 1,250 op-hours, ~40% per-unit cost reduction on those ops). Figure 03 unveiled Oct 2025 — 5'8", 61 kg, 20 kg payload, wireless foot-charging, designed for home + mass manufacture. BotQ throughput went from ~1/day to ~1/hour (24x in 120 days); 350+ F.03 units shipped by early 2026, end-of-line yield >80%. Helix VLA went vertically integrated (broke from OpenAI Feb 2025); Helix 02 (Jan 2026) added whole-body autonomy. Caveat: BMW's first European humanoid pilot (Plant Leipzig, Feb 2026) chose Hexagon's AEON, not Figure 03. No "F.04/F.05" exists yet — Figure 03 is current.

**Tesla Optimus:** V3 production-start targeted summer 2026 at converted Fremont Model S/X line (line ended May 2026); high-volume (tens of thousands) targeted 2027. >1,000 Gen 3 units already deployed in Tesla factories (Gigafactory Texas, Fremont) as of Jan 2026 doing kitting / parts handling. Shares FSD v15 neural arch, runs on FSD chip; AI5 (taped out April 15, 2026) deploys to Optimus + supercomputer first, NOT vehicles — matches H100 inference, AI6 tape-out targeted Dec 2026. Cortex 2.0 training cluster at Giga Texas: 250MW online April 2026, full 500MW mid-2026, purpose-built for robotics + FSD. Long-term price ~$20K at volume. Ashok Elluswamy (Autopilot VP) took over Optimus from Milan Kovac (June 2025) — tightens the FSD/Optimus shared-stack bet. Risk: no external customer; all Musk timelines historically slip.

**1X (Neo):** Pre-orders opened Oct 28, 2025 for NEO at $20K or $499/mo subscription; first-year capacity (10K units, Hayward CA) sold out in 5 days; targeting 100K by EOY 2027. Funded by OpenAI Startup Fund, Tiger Global, EQT Ventures, Samsung NEXT (~$130M+ raised, $1B round reportedly sought Sep 2025). Initial deployments human-in-the-loop teleoperation (privacy concerns). Dec 2025: EQT deal commits up to 10,000 Neo units 2026-2030 to EQT's 300+ portfolio cos — major pivot from consumer-only positioning.

**Agility Robotics (Digit):** Still the most-deployed commercial humanoid in the world. June 2024 was industry-first RaaS deployment at GXO/Spanx (Flowery Branch GA); crossed 100,000-tote milestone in Nov 2025. Toyota Manufacturing Canada signed post-pilot agreement. Amazon continues testing. Factory capacity 10K Digits/yr. GXO is also piloting Apptronik Apollo — Digit isn't sole-sourced.

**Apptronik (Apollo):** Raised $520M Series A-X extension Feb 11, 2026 at $5B valuation; total funding ~$1B (close to $935M Series A total). Lead investors: B Capital + Google; new: AT&T Ventures, John Deere, Qatar Investment Authority; returning: Mercedes-Benz, PEAK6. Mercedes pilots in Berlin-Marienfelde + Hungary. CEO Cardenas guidance: $1B in orders starting 2027 at ~$80K/yr per Apollo. Partner with Google DeepMind on Gemini Robotics models; Jabil JV for production scaling.

**Boston Dynamics (Hyundai-owned):** Electric Atlas product version unveiled at CES 2026 (Jan 5); serial production began March 2026 — first enterprise-grade humanoid shipping at scale. 2026 production fully committed to Hyundai RMAC + Google DeepMind. Specs: 56 DoF, 50 kg lift, 2.3m, waterproof. Hyundai $26B U.S. investment includes a robotics factory targeting 30,000 Atlas/yr by 2028. Hyundai Mobis supplies actuators (vertical integration). Stretch: 20M+ boxes unloaded since 2023; deployed at DHL, Maersk-linked, Gap.

**Sanctuary AI (Phoenix):** Generation 8 unveiled; $140M total raised (Bell/Magna/Workday Ventures + $30M Canadian Strategic Innovation Fund). Leadership upheaval: CEO Geordie Rose removed Nov 2024, CTO Suzanne Gildert left April 2024 — James Wells now interim CEO. Magna pilots ongoing. Ranks #3 globally in humanoid IP per Morgan Stanley. Weakest of the western players on balance-sheet — at risk of consolidation.

**NVIDIA Project GR00T / Jetson Thor / Isaac Lab:** NVIDIA is positioning itself as "the Android of generalist robotics." GR00T N1.7 — 3B-param open VLA, Apache 2.0, 20K hrs EgoScale human-video pretraining. Dual-system (fast action / slow reasoning) architecture. CES 2026 release: Cosmos Transfer 2.5, Cosmos Predict 2.5, Cosmos Reason 2 (VLM brain), Isaac GR00T N1.6, Isaac Lab-Arena (open sim). Jetson Thor in production; Jetson T4000 (Blackwell, CES 2026): 1,200 TFLOPS, 64GB, 40-70W. Synthetic data: NVIDIA generated 780K trajectories (= 6,500 hrs / 9 months of human demos) in 11 hours via Cosmos Transfer — +40% GR00T N1 perf vs real-data-only. Ecosystem: 1X, Agility, Apptronik, Boston Dynamics, Figure, Fourier, Sanctuary, Unitree, XPENG all on stack; Amazon Robotics, Caterpillar, Medtronic, Meta among Thor early adopters. Semi partners (Infineon, NXP, TI) integrating into Thor for motion control / safety / radar.

**Adjacent / industrial automation pure-plays:**
- **Symbotic (SYM):** Q1 FY26 rev $630M (+29% YoY), Q2 FY26 $676M (+23% YoY); flipped to net income, Adj EBITDA $78M Q2 (vs $35M PY). Walmart anchor. Cleanest pure-play warehouse AI exposure.
- **Rockwell Automation (ROK):** FQ4 EPS $3.34 (beat $2.94), rev $2.32B; industrial automation backbone, gateway to AI for factory-floor customers.
- **Cognex:** Industrial machine vision — direct beneficiary of every humanoid + cobot deployment but specific 2026 numbers not surfaced here.

**Category numbers:**
- Humanoid funding: ~$3.2B globally in 2025 alone (Dealroom) — more than prior 6 years combined. China robotics: $7B / 610 deals in 9M 2025 (+250% YoY); UBTECH alone secured $1B strategic facility.
- Unit installations: ~16,000 humanoids shipped in 2025 (Counterpoint); cumulative deployments expected >100,000 by 2027. Tesla targeting 100K cumulative by 2026; Hyundai/Atlas 30K/yr by 2028; Figure 100K over 4 yrs; 1X 100K by EOY 2027; Apptronik commercial scale 2027.
- Market size 2026 estimates: $6.24B (Fortune BI) — $8.32B (Research & Markets); 2030 estimates $15-39B depending on source; Morgan Stanley $5T by 2050.
- China market share leader 2025: AgiBot ~31%, Unitree ~27% (G1 at $16K, R1 at $5,900 — broke price ceiling).
- NVDA Q4 FY26 Automotive & Robotics segment: $604M (+6% YoY, miss vs $654M consensus); full-year FY26 $2.3B (+39%). Tiny share of $130B+ NVDA revenue today — but the strategic optionality is huge.

## Strategic position

Humanoids have crossed from "prototype demos" to "real RaaS revenue at >100K-cycle scale" — Agility/GXO is the proof. 2026 is the inflection where serial production starts at multiple western players simultaneously: Boston Dynamics (Atlas, March 2026 serial), Figure (BotQ 1/hr), Tesla (Optimus V3 summer 2026), Apptronik (post-$520M raise), 1X (Hayward sold-out). Funding scarcity is no longer the bottleneck — execution, manufacturing yield, and a viable customer pipeline are.

The winners-take-most picture is forming around three vertically integrated stacks: (1) **Tesla** owns silicon (AI5/AI6), training cluster (Cortex 2), and end-deployment (own factories) — but no external customer. (2) **Hyundai/Boston Dynamics/DeepMind** triangle owns platform + actuator + end-customer factories + Gemini Robotics brain. (3) **Figure** owns its own Helix VLA, BotQ manufacturing, and proprietary battery — closest western analog to Tesla's vertical model.

Everyone else (1X, Apptronik, Agility, Sanctuary, plus all Chinese players) is converging on the **NVIDIA stack** (GR00T + Thor + Isaac + Cosmos). NVIDIA's bet is that it doesn't matter which humanoid OEM wins — it sells the picks-and-shovels. That parallels the LLM training playbook exactly.

Chinese players (Unitree, AgiBot, UBTECH, BYD's robotics arm) already dominate unit volume and have cracked sub-$10K pricing. The western thesis depends on (a) software / AI moat being durable, (b) regulatory/safety friction in deploying Chinese hardware into U.S./EU factories, and (c) reshoring + tariffs giving domestic OEMs cover.

## Risks

- **Timeline slippage.** Musk's V3 dates are aspirational; Sanctuary teetering financially; 1X is mostly teleoperated today, not autonomous. The gap between "shipping units" and "economically useful units" is still wide.
- **Cost collapse from China.** Unitree R1 at $5,900 reset price expectations. If U.S. OEMs can't get to ~$20K-$30K fast, they're stuck in narrow industrial use cases while Chinese players take the consumer / SMB volume.
- **Customer concentration.** Hyundai/Atlas, Tesla/Tesla, Figure-BMW (just lost Leipzig to Hexagon AEON), Apptronik/Mercedes — most western players have one anchor customer. Defection or pilot-stall = significant valuation pressure.
- **The "useful work" question.** GXO 100K totes is real but narrow. Most demos remain teleoperated or scripted. Helix, GR00T, and Gemini Robotics all need to clear the generalization bar before the unit-economics story works at home.
- **Valuation froth.** Figure at $39B (15x in 18 months) and Apptronik at $5B (~3x in months) on near-zero revenue. If unit shipments disappoint in 2026-2027, the down-round risk is severe and the entire category re-rates.
- **Safety / liability / regulation.** First serious humanoid-caused injury in a factory or home is a category-wide event, not a single-company event.

## Cross-cutting

**Feedback into NVDA + training/inference demand (the key link for an AI semis/datacenter map):**
- Robotics is the **next-generation synthetic data flywheel** for NVDA. Cosmos Transfer generates 9 months of human-demo equivalent in 11 hours of GPU time — every humanoid OEM that adopts GR00T becomes a customer of NVDA training compute (B200/B300/Rubin) for foundation-model pretraining AND of edge Jetson Thor inference silicon.
- Per-robot **on-device inference** (Jetson Thor / T4000): 1,200 TFLOPS, 40-70W class — this is a brand-new SKU category orthogonal to data-center GPUs. Even at 100K robots/yr by 2027, that's 100K Thor-class units = modest revenue line, but margin profile likely strong.
- **Training compute demand**: Each VLA foundation model (GR00T N1, N1.6, N2; Helix; Tesla's policy network) needs O(thousands) of H100/B200 equivalent for pretraining + continuous fine-tuning. Tesla's 500MW Cortex 2 cluster is the largest single robotics-dedicated training site publicly disclosed.
- **Power demand follow-on**: 500MW Cortex 2, plus Hyundai RMAC training infra, plus NVDA Cosmos generation farms — robotics-specific datacenter load is a real (if still small) line in the broader datacenter-power story. Cross-link to power node and datacenter-buildout node.
- **Inference demand**: Robots also drive cloud-side reasoning inference (System 2 / Cosmos Reason 2 / Gemini Robotics 2) — this is incremental token volume for hyperscaler inference fleets, not just on-device. Cross-link to inference-demand node.
- **Symbiotic with auto FSD**: Tesla's FSD-shared neural net + AI5 / AI6 chips going to Optimus first means the auto and robotics theses are now fused at the silicon layer.
- **Adjacent industrial AI winners** (Symbotic, Rockwell, Cognex) are quieter cross-cutting picks — they monetize automation buildouts whether humanoids win or not, with public-equity exposure that the humanoid pure-plays still lack.

## Sources
- [Figure AI Series C / $39B valuation](https://tsginvest.com/figure-ai/)
- [Figure 03 launch + BotQ ramp](https://www.figure.ai/news/ramping-figure-03-production)
- [Figure 03 introduction](https://www.figure.ai/news/introducing-figure-03)
- [Fortune: BMW relationship reality check](https://fortune.com/2025/04/06/figure-ai-bmw-humanoid-robot-partnership-details-reality-exaggeration/)
- [Figure AI Wikipedia](https://en.wikipedia.org/wiki/Figure_AI)
- [Tesla Optimus V3 / Fremont conversion / AI5](https://www.programming-helper.com/tech/tesla-optimus-gen3-production-deployment-2026-factory-robots-revolution)
- [Tesla Optimus V3 specs + timeline](https://airobots.media/technology/tesla-optimus-gen-3-everything-we-know-about-teslas-most-ambitious-product/)
- [Tesla Q1 FY26 8-K](https://www.sec.gov/Archives/edgar/data/0001318605/000162828026003837/exhibit991.htm)
- [1X Neo pre-orders / Hayward factory](https://techfundingnews.com/openai-backed-1x-first-us-humanoid-factory-sold-out-production/)
- [1X x EQT 10,000-unit deal](https://techcrunch.com/2025/12/11/1x-struck-a-deal-to-send-its-home-humanoids-to-factories-and-warehouses/)
- [1X Technologies Wikipedia](https://en.wikipedia.org/wiki/1X_Technologies)
- [Agility Digit 100K-tote milestone at GXO](https://roboticsandautomationnews.com/2025/11/24/agility-robotics-digit-humanoid-passes-100000-tote-milestone-in-live-gxo-implementation/96877/)
- [GXO-Agility RaaS agreement](https://gxo.com/news_article/gxo-signs-industry-first-multi-year-agreement-with-agility-robotics/)
- [Apptronik $520M Series A-X at $5B](https://www.cnbc.com/2026/02/11/apptronik-raises-520-million-at-5-billion-valuation-for-apollo-robot.html)
- [Apptronik-Mercedes pilot](https://www.prnewswire.com/news-releases/apptronik-and-mercedes-benz-enter-commercial-agreement-that-will-pilot-apptroniks-apollo-humanoid-robot-in-mercedes-benz-manufacturing-facilities-302089972.html)
- [Boston Dynamics electric Atlas CES 2026 + serial production](https://bostondynamics.com/blog/boston-dynamics-unveils-new-atlas-robot-to-revolutionize-industry/)
- [Hyundai 30K Atlas/yr at Metaplant](https://www.axios.com/2026/01/05/hyundai-humanoid-robots-boston-dynamics)
- [Sanctuary AI Phoenix specs + leadership](https://blog.robozaps.com/b/sanctuary-ai-phoenix-review)
- [NVIDIA Isaac GR00T developer page](https://developer.nvidia.com/isaac/gr00t)
- [NVIDIA GR00T announcement (Project GR00T)](https://nvidianews.nvidia.com/news/foundation-model-isaac-robotics-platform)
- [NVIDIA at CES 2026 - Android of robotics](https://techcrunch.com/2026/01/05/nvidia-wants-to-be-the-android-of-generalist-robotics/)
- [NVIDIA Jetson Thor launch](https://www.datacenterdynamics.com/en/news/nvidia-launches-jetson-thor-compute-modules-for-humanoid-robots/)
- [NVIDIA Q4 FY26 8-K press release](https://www.sec.gov/Archives/edgar/data/0001045810/000104581026000019/q4fy26pr.htm)
- [NVIDIA Q4 FY26 segment breakdown - ServeTheHome](https://www.servethehome.com/nvidia-reports-q4-fy2026-earnings-data-center-and-proviz-drive-revenue-records/)
- [Symbotic Q1 FY26 8-K](https://www.sec.gov/Archives/edgar/data/0001837240/000183724026000008/q1268-k_ex991.htm)
- [Symbotic Q2 FY26 8-K](https://www.sec.gov/Archives/edgar/data/0001837240/000183724026000023/q2268-k_ex991.htm)
- [Morgan Stanley humanoids $5T by 2050](https://www.morganstanley.com/insights/articles/humanoid-robot-market-5-trillion-by-2050)
- [Fortune BI humanoid market size](https://www.fortunebusinessinsights.com/humanoid-robots-market-110188)
- [Future Market Insights humanoid forecast](https://www.futuremarketinsights.com/reports/humanoid-robot-market)

_new_nodes_suggested:
- **R2 — China humanoid stack (Unitree / AgiBot / UBTECH / BYD)**: Unit-volume leader (~58% global share), sub-$6K pricing, gov-subsidy backed; the bear case for U.S. valuations.
- **R3 — Robotics foundation models / VLA layer (Helix, GR00T, Gemini Robotics, pi-zero, Cosmos)**: The AI layer separable from the humanoid OEMs; where the durable moat probably lives.
- **R4 — Industrial automation public equities (Symbotic / Rockwell / Cognex / Keyence)**: Diversified picks-and-shovels exposure that monetizes automation regardless of which humanoid OEM wins.
- **R5 — Robotics-specific training infrastructure (Cortex 2 / Hyundai RMAC / NVDA Cosmos farms)**: Cross-link from this node back into the datacenter-power and AI-training-compute nodes — robotics is becoming a non-trivial training-compute consumer.
- **R6 — Edge robotics inference silicon (Jetson Thor / T4000 / Tesla AI5)**: A new high-margin silicon category orthogonal to data-center GPUs.

---

## AV / robotaxi compute

## Current state (May 2026)

The AV / robotaxi sector has bifurcated into a small set of scaled commercial operators and a much larger group of L2+/L3 ADAS programs at OEMs, with all participants now best understood as multi-thousand-GPU customers for training and multi-million-unit customers for edge inference silicon.

**Waymo (Alphabet) - clear commercial leader.** Raised a $16B round in Feb 2026 at a $126B post-money valuation (largest AV financing ever), led by Dragoneer, DST and Sequoia, with Alphabet contributing ~$13B as anchor. Operating ~500,000 paid rides/week (up from 250K/wk in late 2024 and 200K/wk in early 2025), across 10 US cities (SF, LA, Phoenix, Atlanta, Austin, Miami plus newly launched Dallas, Houston, San Antonio, Orlando). Fleet ~3,000-3,500 vehicles. Targeting >20 cities and 1M rides/week by year-end, including first international markets in London and Tokyo. 6th-gen platform is the inflection: built on Zeekr-made minivan (rebranded "Waymo Ojai", Geely SEA-M, 800V) and Georgia-built Hyundai Ioniq 5; final assembly with Magna in Mesa, AZ. Published its own scaling-law paper confirming LLM-style power-law gains with compute/data, but optimal models are smaller and more data-hungry than LLMs.

**Tesla FSD + Robotaxi - software gap closing, fleet still tiny vs Waymo.** FSD v14.3.x rolling out on HW4/AI4 since April 2026 (MLIR-rewritten compiler, +20% reaction time, RL post-training, intervention-free streak counter in v14.3.3). v14 Lite for HW3 confirmed for late June 2026 (functional parity claimed, but explicitly not enough for unsupervised Robotaxi). Austin robotaxi launched June 2025 with safety monitors; unsupervised fleet reached just ~25 verified vehicles cumulatively by end of April 2026 (Austin 19, Dallas 3, Houston 3), with 165 total active vehicles (mostly supervised Bay Area). May 4, 2026 milestone: unsupervised evening operations in Austin. Next-wave cities (Phoenix, Miami, Orlando, Tampa, Vegas) slipping. Cybercab: first prototype Feb 17, 2026; volume production began April 2026 at Giga Texas (S-curve, slow ramp, material revenue not before 2027); unboxed assembly targets 1 vehicle / 10 seconds long-term; unsupervised FSD for Cybercab "probably Q4" per Musk.

**Tesla custom silicon.** AI5 (HW5) taped out April 15, 2026, dual-sourced from TSMC Arizona and Samsung Taylor TX (2nm GAA); samples late 2026, high-volume 2H 2027 per Samsung. Tesla-Samsung deal is $16.5B through 2033. Claims: 8x compute, 9x memory, 5x bandwidth, 40x "composite" performance vs AI4; dual AI5 ~ NVIDIA Blackwell. Dojo terrestrial was killed in Aug 2025 (Bannon + ~20 to DensityAI startup); Dojo 3 (D3) was restarted Jan 2026 as a **space-based** compute project paired with SpaceX Starship-launched "AI Sat Mini" orbital racks, with D3 silicon on Samsung Texas 2nm and Intel EMIB packaging, targeting AI7 generation timeline (~2028-2029 deployment). Texas Terafab (announced March 21, 2026, ~$55B initial / $119B total; Intel joined April 7, 2026 as primary mfg partner using 18A then 14A; sits adjacent to Giga Texas) is the long-dated piece - already represented in graph as part of C5.

**Training compute.** Tesla Cortex (Giga Texas) at ~67k H100-equivalent (incl. 16k H200 added in 2H 2025). Following SpaceX's Feb 2, 2026 acquisition of xAI ($1.25T combined), the Memphis Colossus 2 cluster (~555k GPUs, $18B silicon, 1 GW operational scaling to 2 GW; 41 gas turbines permitted) now feeds Tesla FSD training as well as Grok. This is the largest single-site AI training factory in the world and is now structurally fused with Tesla's AV roadmap.

**Mobileye (MBLY).** Q1 2026 revenue $558M, +27% YoY, GM 49%, adj EPS $0.12 (beat). EyeQ SoC volumes +28%. EyeQ6 High SuperVision in pre-production US drives (2,000+ km route incl. heavy snow, very few interventions). VW Group programs are the strategic core: ID. Buzz autonomous (MOIA robotaxi) pre-series production at Hanover started Q1; full homologation targeted 1H 2027. New Surround ADAS design win at Mahindra; new SuperVision second customer. Announced $250M buyback. Raised 2026 outlook.

**Cruise (GM) - confirmed shut down.** Note: shutdown was officially announced **Dec 10, 2024**, not October 2024 (the Oct 2023 date is the pedestrian-dragging incident that grounded the fleet). GM took ownership above 97%, folded the remaining team into GM personal-vehicle ADAS (Super Cruise). >$10B cumulative operating losses vs <$500M revenue. Robotaxi market effectively de-duopolized to Waymo + Tesla in the US.

**Wayve.** Closed a $1.2B Series D in Feb 2026 at $8.6B post (Eclipse, Balderton, SoftBank Vision Fund 2 leading; NVIDIA, Microsoft, Uber, Mercedes, Nissan, Stellantis participating; OTPP, Baillie Gifford, BBB also in). $60M Series D extension from AMD, Arm and Qualcomm Ventures - notable that every major edge-AV silicon vendor is now on Wayve's cap table. Cumulative funding ~$1.5B. Gen 3 platform runs on NVIDIA Drive AGX Thor. Uber committed up to $300M milestone-based, first Uber+Wayve robotaxi service planned in London 2026, Tokyo pilot late 2026 with Nissan. Stellantis integrating Wayve AI Driver into STLA AutoDrive; Nissan production from FY2027; Mercedes participating. Claims zero-shot driving in 500+ cities across 70 countries.

**Aurora Innovation.** Driverless trucking now Fort Worth to El Paso (extended from initial Fort Worth-Dallas in 2024). Plans driverless without partner-requested observer in Q2 2026. Volvo VNL Autonomous integration on pilot line at New River Valley; Volvo targeting hundreds of trucks in 2027. PACCAR co-developing 3rd-gen Aurora Driver kit with AUMOVIO integrated on assembly lines. Roush upfit capacity ramping to 1,000 trucks/year as interim. Customers: FedEx, Hirschbach, Ryder, Schneider, Werner, Uber Freight, plus Toyota and NVIDIA as ecosystem partners.

**Pony.ai (PONY).** Fleet >1,700 robotaxis by May 2026; targeting >3,000 by year-end and >20 cities. Q4 2025 robotaxi revenue +160% YoY, fare-charging +500%. City-wide unit-economics breakeven achieved in Guangzhou (Nov 2025) and Shenzhen (Feb 2026); peak Shenzhen vehicle did RMB394 net rev / day at 25 orders. Gen-7 vehicles; targeting <RMB230k total BOM (vehicle + ADK) by mid-2027. Tencent WeChat Mobility Services integration in Guangzhou (March 2026); partners include Stellantis, Uber, Bolt, ComfortDelGro. First Europe robotaxi commercial deployment in Croatia.

**WeRide (WRD).** Global fleet 1,023 as of Jan 2026, targeting >2,600 by year-end via 2,000-unit Robotaxi GXR purpose-built program with Geely Farizon. Permits in 8 countries (China, UAE, Singapore, France, Switzerland, KSA, Belgium, US). Massive Uber partnership: 1,200 robotaxis across Abu Dhabi, Dubai, Riyadh, completion as soon as 2027; ME fleet ramping from >200 to 500-1,000 in 2026 then several thousand. Dubai fully driverless fare-charging launched March 31, 2026 (Jumeirah/Umm Suqeim, Uber app). Abu Dhabi downtown launch Feb 12, 2026 covers ~70% of core. Switzerland (Furttal/Zurich) driverless permit Nov 2025; France Robobus with Renault.

**Edge silicon at OEMs (ex-Tesla/Mobileye).**
- **NVIDIA Drive Thor (~2,000 TOPS)** is now ramping with Zeekr (first customer), BYD, GAC Aion Hyper, JLR, Lucid, plus Wayve's Gen 3 reference design and Nissan robotaxi prototype on Drive Hyperion. Orin still anchors L2/L3.
- **Qualcomm Snapdragon Ride Pilot** debuted on the BMW iX3 Neue Klasse ("Superbrain" of automated driving; hands-off / eyes-on up to 130 km/h, DCAS-certified in 60 countries scaling to 100). May 21, 2026 Stellantis expanded Qualcomm partnership across cockpit + ADAS portfolio for L2+ hands-free; **Stellantis aiMotive AV subsidiary signing LOI to join Qualcomm** - notable consolidation. Snapdragon Digital Chassis integrated with STLA Brain. Continues to win sockets at GM, Renault.
- **BMW dropped Personal Pilot L3** with the Apr 2026 7 Series facelift (replaced by L2++ Motorway Assistant from iX3; Mercedes had also abandoned L3); industry has effectively conceded L3 commercial readiness for now.
- **Toyota** is taking a Woven by Toyota / Arene-based ML-stack approach; Arene debuting in 2026 RAV4 and coming to Lexus ES and next-gen EVs.
- **Ford and Rivian** still publicly targeting L3 in 2026.

## Strategic position

**The map is now Waymo-dominant in robotaxis, Mobileye-dominant in L2+/L3 ADAS at western OEMs, with Tesla as the wild card whose value is bound to its software/Cybercab S-curve.** Waymo's $126B valuation already exceeds Ford or GM market cap, and at ~500k rides/wk it has a >100x lead over Tesla's ~25-vehicle unsupervised fleet. Cruise's exit means the US robotaxi market has effectively de-risked to two players, and the question shifts to whether Tesla can convert its software story (FSD v14.3, v14 Lite, Cybercab) and its vertically integrated silicon (AI5 on Samsung Taylor + TSMC AZ + future Terafab on Intel 14A) into a unit-economics lead before Waymo's cost-down (Ojai/Hyundai chassis, 6th-gen sensor stack) compounds.

Wayve has become the structurally most-interesting startup because it sits between NVIDIA (Thor in vehicle, GPUs in training) and a coalition of OEMs that don't want to depend on Mobileye or build in-house - Mercedes/Stellantis/Nissan/Uber/SoftBank in one round is unusual. Mobileye's VW ID. Buzz / MOIA program is the most credible non-Waymo non-Tesla robotaxi production pipeline through 2027.

In China, the unit-economics story is now real: Pony.ai has crossed city-wide breakeven in two Tier-1 cities, and WeRide+Uber's Middle East commitment (1,200 vehicles in 18-30 months) is a sovereign-backed beachhead that the US players cannot easily replicate.

Aurora is structurally separate (long-haul trucking, not robotaxi) and benefits from a much narrower ODD plus willing OEM partners (Volvo, PACCAR). The Q2 2026 "no-observer" milestone and Roush 1,000-trucks/year capacity are the real catalysts to watch.

## Cross-cutting

- **NVIDIA edge silicon flow (link to A1/A2 NVIDIA nodes and to NVIDIA Drive franchise):** Drive Orin remains the L2/L3 workhorse; Drive Thor is the L4 inflection chip and is in Zeekr, BYD, GAC Hyper, JLR, Lucid, plus Wayve's Gen 3 reference and Nissan's Drive Hyperion robotaxi prototype. NVIDIA is now a direct investor in Wayve (Series C + D), making Wayve effectively a software demo / proof point for the Drive platform.
- **Training cluster demand (link to compute / hyperscaler nodes):** Every credible AV player is now a 10k+ GPU customer. Tesla Cortex = 67k H100-equivalents; xAI/SpaceX Colossus 2 = ~555k GPUs / 1-2 GW, now feeding Tesla training; Waymo runs Carcraft + a published-scaling-law training stack on Alphabet TPUs/Trillium; Wayve raised $1.5B in part to buy training compute on NVIDIA hardware; Mobileye/MOIA, Aurora, Pony.ai, WeRide all run 1000+ GPU training pipelines. This makes AV one of the more durable end-customer segments for AI training silicon, distinct from frontier-LLM demand.
- **Foundry / packaging (link to C5 Texas Terafab, F1 Samsung Taylor, F2 TSMC Arizona, M1 Intel 18A/14A):** Tesla's AI5/AI6/D3 roadmap is now the single largest non-NVIDIA, non-Apple US 2nm customer. Samsung Taylor's anchor tenant is Tesla ($16.5B deal). Intel 14A's first announced external customer is Terafab. EMIB and Foveros are the packaging tech bridging AI5 modules and the D3 satellite racks.
- **China silicon export-control exposure:** Pony.ai, WeRide, and BYD all sit on Drive Orin / Thor for now; if US tightens "connected vehicle" rules (NVIDIA already flagged this risk in 10-Q), the Chinese AV stack pivots to Horizon Robotics / Black Sesame / domestic alternatives - feeds the China semis decoupling node.
- **Robotics spillover (link to humanoid / Optimus nodes):** Tesla AI5 chip is explicitly dual-use for FSD + Optimus; Wayve calls its product "embodied AI"; NVIDIA Drive AGX and Jetson/Isaac share architectural roots. Edge AV silicon vendors are de facto humanoid silicon vendors.
- **Power constraint (link to power / data center nodes):** Colossus 2's gas-turbine permitting fight and Terafab's >1 TW long-term compute goal explicitly tie AV training scale to behind-the-meter power and to space-based compute (D3) - the AV node is now a power-constrained node.

## Risks

- Tesla's unsupervised robotaxi fleet has grown from single digits in Jan 2026 to ~25 by end-April; if v14.x and Cybercab don't deliver unit-economics by 2027, the Cybercab ramp investment underwrites a product without a market. AI5 / Terafab schedule slippage is the existential risk Musk himself flagged.
- Waymo cost-down on Ojai (Geely chassis under tariffs) and ride-volume guidance (1M/wk by YE 2026) depend on AZ/Magna throughput and on regulatory clearance in 20+ new cities; school-bus and pedestrian incidents in late 2025/early 2026 are early signs of scaling stress.
- Mobileye is heavily concentrated on VW Group for its robotaxi narrative; ID. Buzz homologation slipping past 1H 2027 would re-rate the stock.
- BMW + Mercedes both dropping L3 commercially is a negative signal for any "L3 as a paid feature" thesis; Ford/Rivian 2026 L3 commitments may slip similarly.
- Cruise shutdown shows how quickly a $10B AV bet can be unwound; any large incident at Waymo or Tesla in 2026 could trigger a similar regulator-driven retrenchment.
- Pony.ai and WeRide US-listed shares are exposed to US/China connected-vehicle rules and to forced delisting risk; their hardware stacks rely on NVIDIA Drive today.
- Wayve's $8.6B valuation implies meaningful revenue from Nissan/Stellantis/Mercedes by 2027-2028; OEM software programs historically slip.
- D3 (space compute) is on a 2028-2029 timeline and depends on Starship cadence + radiation-hardened 2nm yield - very long-dated, high-risk.

## Sources
- [Tesla begins Cybercab robotaxi production at Giga Texas (Yahoo Finance, Apr 2026)](https://finance.yahoo.com/markets/stocks/articles/tesla-begins-cybercab-robotaxi-production-154930610.html)
- [Tesla Cybercab production begins April 2026 (InsideEVs)](https://insideevs.com/news/778232/tesla-cybercab-production-april-2026/)
- [Tesla begins robotaxi production, Cybercab ramp expected to accelerate (TechXplore)](https://techxplore.com/news/2026-04-tesla-robotaxi-production-cybercab-ramp.html)
- [Tesla Robotaxi service Austin milestone (Teslarati, May 2026)](https://www.teslarati.com/tesla-robotaxi-service-austin-achieves-monumental-new-accomplishment/)
- [Tesla Robotaxi status check: 8 months in, 19% availability (Electrek, Feb 2026)](https://electrek.co/2026/02/16/tesla-robotaxi-status-check-8-months-in/)
- [Tesla Robotaxi unsupervised fleet ramping (Electrek, Apr 2026)](https://electrek.co/2026/04/30/tesla-robotaxi-unsupervised-finally-signs-ramping-up/)
- [Tesla FSD v14.3 Rolling Out (AutoPilot Review)](https://www.autopilotreview.com/full-self-driving-update/)
- [Tesla FSD v14.3.3 release notes (TeslaOracle, May 17 2026)](https://www.teslaoracle.com/2026/05/17/tesla-fsd-v14-3-3-2026-14-6-6-adds-a-new-fsd-intervention-free-live-streak-counter-video-release-notes/)
- [Tesla FSD v14 Lite features and release timeline (Not a Tesla App)](https://www.notateslaapp.com/news/4038/tesla-announces-fsd-v14-lite-features-and-release-timeline)
- [Musk says Tesla restarted Dojo3 for space-based compute (TechCrunch, Jan 2026)](https://techcrunch.com/2026/01/20/elon-musk-says-teslas-restarted-dojo3-will-be-for-space-based-ai-compute/)
- [Dojo Isn't Dead, It's Moving Off-World (Not a Tesla App)](https://www.notateslaapp.com/news/3858/dojo-isnt-dead-its-moving-off-world-a-look-at-teslas-d3-space-chip)
- [Tesla D3 chip targets space (Inspire2Rise)](https://www.inspire2rise.com/tesla-d3-chip-targets-space-massive-ai-compute.html)
- [Tesla AI5 tape-out details (Wccftech, 2026)](https://wccftech.com/tesla-pulls-2nm-ai-chip-production-onto-us-soil-splits-ai6-ai6-5-between-samsung-tsmc/)
- [Samsung Taylor TX equipment move-in for Tesla AI5/AI6 (evXL)](https://evxl.co/2026/04/16/samsungs-taylor-texas-tesla-ai5-ai6-chips/)
- [Tesla & SpaceX launch Terafab $119B chip megafactory (Basenor)](https://www.basenor.com/blogs/news/tesla-spacex-launch-terafab-119b-chip-megafactory)
- [Terafab (Wikipedia)](https://en.wikipedia.org/wiki/Terafab)
- [Musk: Tesla will use Intel 14A at $20bn Terafab (DCD)](https://www.datacenterdynamics.com/en/news/elon-musk-says-tesla-will-use-intel-14a-technology-at-its-20bn-terafab-project-in-austin/)
- [Waymo raises $16B at $126B valuation (Electrek, Feb 2026)](https://electrek.co/2026/02/02/waymo-raises-16-billion-round-at-126-billion-valuation-plans-expansion/)
- [Waymo announces $16B round (CNBC)](https://www.cnbc.com/2026/02/02/waymo-announced-16-billion-fundraising-round.html)
- [Waymo skyrocketing ridership (TechCrunch, Mar 2026)](https://techcrunch.com/2026/03/27/waymo-skyrocketing-ridership-in-one-chart/)
- [Waymo robotaxis in 10 US cities (TechCrunch, Feb 2026)](https://techcrunch.com/2026/02/24/waymo-robotaxis-are-now-operating-in-10-us-cities/)
- [Waymo Ojai branding (Insideevs)](https://insideevs.com/news/783573/waymo-zeekr-ojai-van/)
- [Waymo rebranding Zeekr robotaxi (TechCrunch, Jan 2026)](https://techcrunch.com/2026/01/07/waymo-is-rebranding-its-zeekr-robotaxi/)
- [Waymo scaling laws research (Data Center Dynamics)](https://www.datacenterdynamics.com/en/news/waymo-research-confirms-self-driving-scaling-laws-with-more-compute-and-data-leading-to-better-av/)
- [GM exits robotaxi market, brings Cruise in house (CNBC, Dec 2024)](https://www.cnbc.com/2024/12/10/gm-halts-funding-of-robotaxi-development-by-cruise.html)
- [GM shuts Cruise robotaxi unit (Smart Cities Dive)](https://www.smartcitiesdive.com/news/general-motors-shuts-cruise-robotaxi-unit-mary-barra/735205/)
- [Mobileye Q1 2026 results (Mobileye IR)](https://ir.mobileye.com/news-releases/news-release-details/mobileye-releases-first-quarter-2026-results-updates-full-year)
- [Mobileye Q1 2026 earnings transcript (Investing.com)](https://www.investing.com/news/transcripts/earnings-call-transcript-mobileye-q1-2026-beats-forecasts-stock-surges-93CH-4632778)
- [Wayve raises $1.2B from NVIDIA, Uber, three automakers (TechCrunch, Feb 2026)](https://techcrunch.com/2026/02/24/self-driving-tech-startup-wayve-raises-1-2b-from-nvidia-uber-and-three-automakers/)
- [Wayve secures $1.5B Series D total (Wayve press)](https://wayve.ai/press/series-d/)
- [Wayve Series D extension AMD Arm Qualcomm (TNW)](https://thenextweb.com/news/wayve-60m-series-d-autonomous-driving)
- [NVIDIA Microsoft back Wayve at $8.6B valuation (CNBC)](https://www.cnbc.com/2026/02/24/wayve-fundraise-nvidia-microsoft.html)
- [Aurora 2026 plans (Trucking Info)](https://www.truckinginfo.com/news/aurora-heads-into-2026-with-big-plans-on-tap)
- [Aurora driverless Fort Worth to El Paso (Aurora IR)](https://ir.aurora.tech/news-events/press-releases/detail/128/aurora-expands-driverless-trucking-service-from-fort-worth-to-el-paso)
- [Pony.ai Q1 2026 6-K (SEC)](https://www.sec.gov/Archives/edgar/data/1969302/000110465926034888/tm269906d1_ex99-1.htm)
- [Pony.ai + Tencent Mobility integration (Pony IR, Mar 2026)](https://ir.pony.ai/news-releases/news-release-details/ponyai-expands-robotaxi-access-integration-tencent-mobility)
- [WeRide + Uber 1,200 robotaxis Middle East (Uber IR)](https://investor.uber.com/news-events/news/press-release-details/2026/WeRide-and-Uber-to-Deploy-1200-Robotaxis-in-the-Middle-East-2026--kIzNfL9kh/default.aspx)
- [WeRide + Uber Dubai driverless launch (Uber IR, Mar 2026)](https://investor.uber.com/news-events/news/press-release-details/2026/WeRide-and-Uber-Launch-Fully-Driverless-Robotaxi-Fare-Charging-Operations-in-Dubai-Accelerating-Autonomous-Mobility-in-the-Middle-East-2026-NSiF0EFKhd/default.aspx)
- [WeRide + Geely Farizon 2,000 GXR robotaxis (WeRide IR)](https://ir.weride.ai/news-releases/news-release-details/weride-and-geely-farizon-deliver-2000-purpose-built-robotaxi)
- [Qualcomm + BMW Snapdragon Ride Pilot launch (TheFastMode)](https://www.thefastmode.com/technology-solutions/44453-qualcomm-bmw-unveil-snapdragon-ride-pilot-ushering-in-next-gen-automated-driving)
- [Stellantis + Qualcomm expand partnership (Stellantis, May 2026)](https://www.stellantis.com/en/news/press-releases/2026/may/stellantis-and-qualcomm-expand-partnership-to-adopt-snapdragon-digital-chassis-driver-assistance-cockpit-and-connectivity-platforms-across-next-generation-vehicle-architectures)
- [BMW drops L3 ADAS (Automotive World, Feb 2026)](https://www.automotiveworld.com/news/bmw-drops-level-3-adas-as-industry-backing-ebbs-away/)
- [Mercedes / BMW abandon L3 (Electrive, Feb 2026)](https://www.electrive.com/2026/02/23/following-mercedes-bmw-also-abandons-level-3-automated-driving/)
- [Toyota AI vision Woven by Toyota Arene (WardsAuto)](https://www.wardsauto.com/news/toyota-reveals-grand-ai-vision-for-vehicles-and-beyond/818907/)
- [NVIDIA Drive Thor unveiling (NVIDIA Newsroom)](https://nvidianews.nvidia.com/news/nvidia-unveils-drive-thor-centralized-car-computer-unifying-cluster-infotainment-automated-driving-and-parking-in-a-single-cost-saving-system)
- [xAI Memphis Colossus 2 / 555k GPUs (Basenor)](https://www.basenor.com/blogs/news/xai-memphis-supercomputer-nears-555-000-gpus-in-2gw-ai-arms-race)
- [xAI Colossus 2 1 GW online (Teslarati)](https://www.teslarati.com/elon-musk-xai-brings-1gw-colossus-2-ai-training-cluster-online/)

## _new_nodes_suggested
- **V1a Waymo / Alphabet AV stack** - $126B private company at >500k rides/wk, on Alphabet TPU/Trillium training infra; large enough to be its own node, would link to A2 Alphabet hyperscaler and to compute training-customer flows.
- **V1b Wayve / NVIDIA-OEM coalition** - $8.6B startup is the cleanest "NVIDIA + OEM coalition" play (Mercedes/Nissan/Stellantis/Uber + AMD/Arm/Qualcomm cap table); could be its own node bridging V1 AV and compute/edge-silicon.
- **V1c Mobileye + VW MOIA robotaxi** - the only credible non-Waymo non-Tesla 2026-2027 robotaxi production pipeline at a major OEM, deserves separate tracking from broad MBLY node.
- **V2 / RB1 Humanoid robotics compute** - Tesla AI5 is explicitly dual-use for FSD and Optimus, Wayve self-describes as "embodied AI", NVIDIA Drive ~ Jetson Thor; humanoid is a near-twin of AV compute and should be a sibling node if not already on graph.
- **D3 / Space-based AI compute** - Tesla D3 + SpaceX Starship + AI Sat Mini orbital racks is a distinct, long-dated compute theme that doesn't fit either AV or terrestrial data-center nodes cleanly.
- **AV-trucking (Aurora / Kodiak / Plus)** - long-haul trucking is structurally separate from robotaxi (narrower ODD, OEM-led integration with Volvo/PACCAR, B2B customers); could be split out from V1.
- **China-AV connected-vehicle export-control risk** - Pony.ai, WeRide, BYD reliance on NVIDIA Drive vs Horizon Robotics / Black Sesame substitution path is a cross-cutting node that touches V1, China semis, and US export controls.
- **Robotaxi unit-economics breakeven** - Pony.ai's Guangzhou/Shenzhen city-wide breakeven and WeRide ME operational profitability are the first hard datapoints on AV unit economics; could be tracked as a cross-cutting metric node.

---

## EDA tools — Cadence, Synopsys, Ansys

## Current state (May 2026)

The EDA industry has consolidated into a duopoly-plus-one structure: Synopsys + Ansys (now combined), Cadence (rapidly expanding into systems/simulation), and Siemens EDA. Together they control ~74% of global EDA. AI-driven design demand is the dominant tailwind — both leaders posted record backlogs in Q1 FY2026 driven by hyperscaler custom-silicon (Trainium, Maia, TPU, Axion, MTIA) and advanced-node tapeouts at TSMC N3/N2/A16/A14.

**Cadence Design Systems (CDNS)**
- Q1 FY2026 revenue: $1.474B, +19% YoY. Non-GAAP operating margin 44.7%. Record backlog $8B (ahead of plan). FY2026 guidance: $6.125–6.225B revenue, +17%, targeting 'Rule of 60' for the first time.
- Segment mix: Core EDA +18% (Palladium Z3 emulation 'best quarter ever'); IP +22% (record IP deal at leading global foundry tied to 2nm; HBM/UCIe/PCIe/CXL/Ethernet/Tensilica); System Design & Analysis +18% (3D-IC + multiphysics).
- Cerebrus AI Studio (now agentic, multi-block, multi-user) claims 5–10× chip delivery acceleration; ChipStack AI Super Agent launched Feb 2026 with up to 10× verification productivity; AgentStack/ViraStack/InnoStack announced at CadenceLIVE Silicon Valley (Apr 2026) extend agentic AI across RTL, analog, digital implementation; Google Cloud collaboration layers Gemini reasoning into ChipStack.
- TSMC partnership (Apr 2026) covers N3/N2/A16/A14 with 'agent-ready' digital and analog flows; NanoFlex Pro support in Genus/Innovus/Cerebrus.
- NVIDIA collaboration (Mar 2026): accelerated engineering solutions for agentic AI chip + system design; Millennium GPU platform extending into 3D-IC signoff (IR drop, thermal, stress).
- Allegro X Design Platform integrates IC-to-package-to-PCB co-design; Clarity 3D Solver, Celsius Thermal Solver, Voltus, Fidelity CFD, MSC Actran (from Hexagon DEC acquisition) form the multiphysics stack.
- M&A: BETA CAE ($1.24B, 2024); Hexagon Design & Engineering Centre (~$3B, closed early 2026) — contributing ~$20M Q1, $160M expected in FY26, accretive in 2027.
- Market cap ~$79.6B (Apr 2026); P/E ~71×; stock -7.8% YTD.

**Synopsys (SNPS)**
- $35B Ansys acquisition closed July 17, 2025 after China antitrust approval (July 14, 2025). Final terms: $197 cash + 0.3450 SNPS shares per ANSS share. Divested Optical Solutions Group (Code V, LightTools, RSoft) to Keysight; Ansys divested PowerArtist.
- Q1 FY2026 revenue: $2.41B, +66% YoY (first quarter with full Ansys contribution). Non-GAAP EPS $3.77. Non-GAAP op margin 42.1%. Backlog $11.3B.
- Segments: Design Automation $2.0B, +96% YoY (Ansys + EDA momentum). Design IP $407M, -6.5% YoY — explicitly called a 'transitional year' as hyperscalers (NVIDIA, Google, Amazon) rely on custom proprietary IP that bypasses the catalog.
- Ansys contribution: ~$886M in Q1 FY2026 — multi-physics, thermal, EM, structural simulation; first integrated joint solutions expected H1 2026, monetization in FY27; $400M revenue synergy target by year 4.
- April 2026: announced ~2,000 layoffs (~10% of workforce), largest restructuring in 40-year history, citing integration costs above plan even amid record revenue.
- Synopsys.ai: customers seeing up to 50% faster knowledge assistance, 70% faster workflow, 5× faster formal testbench generation. AgentEngineer roadmap underway.
- Fusion Compiler + PrimeTime achieved '100% usage on critical tapeouts at 2nm and below'.
- IP wins: 40+ PCIe design wins in Q1; first PCIe 8.0 demo; 224G SerDes leadership with 10 lifetime wins.
- Divestiture: planned sale of ARC processor IP business to GlobalFoundries to focus on interface + foundation IP.
- FY2026 guidance: $9.56–9.66B revenue, non-GAAP EPS $14.38–14.46. $2B buyback authorization.
- Market cap ~$80B (Apr 2026); stock -11.1% YTD; total stockholders' equity ~$30.5B; total debt ~$10B ($4.3B term loan repaid).

**Ansys (now Synopsys)**
- Provides multi-physics simulation: thermal (critical for 3D-IC, HBM stacks, B200/Rubin-class GPUs), electromagnetic, structural, CFD. Now bundled into Synopsys silicon-to-systems offering.
- Joint Synopsys + Ansys revenue creates ~46% share of the combined EDA + simulation market; expands TAM to $31B.

**Siemens EDA (formerly Mentor Graphics)**
- ~13–13.5% global EDA share (#3). Calibre physical verification remains the de facto industry standard — TSMC, Samsung, Intel all require 'Calibre-clean' DRC/LVS sign-off, giving permanent relevance regardless of other tool battles.
- EDA AI System launched at DAC 2025 with NVIDIA NIM/Nemotron: Aprisa AI, Calibre Vision AI, Solido AI.
- June 2025: Innovator 3D IC and Calibre 3DStress for 2.5D/3D heterogeneous integration.
- Strengths: deep integration with Siemens Xcelerator (PLM) → automotive/aerospace; weakness: slower generative AI rollout vs. CDNS/SNPS.

## Strategic position

**Picks-and-shovels with extreme moats.** EDA is the textbook example of a critical, low-CapEx, high-margin enabler of the AI buildout. ~60%+ non-GAAP operating margins (CDNS 44.7% in Q1 FY26; SNPS 42.1% with Ansys integration drag), recurring revenue >85% of total, multi-year ratable contracts, multi-year backlogs ($8B CDNS, $11.3B SNPS). Switching costs are exceptional because tool flows are calibrated to specific foundry process nodes, qualified by TSMC/Samsung/Intel, and embedded in customer methodology libraries built over years.

**Custom-silicon flywheel (the core thesis).** Every hyperscaler is now a chip designer. Trainium 3 (AWS, on TSMC N3/N2), Maia 200 (Microsoft, on N2), TPU v7 (Google), MTIA (Meta), Axion CPU, plus startups (Tenstorrent, Groq, SambaNova, Etched, Rivos, etc.) all consume the same EDA stacks. Engineering effort for an advanced AI chip has more than doubled (IBS: ~10k → ~24k engineering-months) and cost has gone from $245M to $539M per design. More designs × more engineers per design × more tool seats per engineer = compounding seat growth for CDNS, SNPS, Siemens EDA. IBS projects 70% of chips will have AI acceleration by 2030.

**AI-on-AI inflection.** Cerebrus AI Studio, ChipStack AI Super Agent, Synopsys.ai, AgentEngineer, Siemens EDA AI System all promise 5–10× productivity. Critically, EDA vendors are positioning AI as a force multiplier on seat value, not a seat-replacement — pricing is shifting toward outcome/value-based metering on top of the existing seat base. This is the opposite of the horizontal-SaaS AI threat.

**Advanced-node + 3D-IC tailwind.** N2/A16/A14, chiplets, UCIe, HBM3E/HBM4 stacks all increase EDA intensity dramatically. Multi-physics signoff (electrical + thermal + stress + EM) is now mandatory — directly favors Synopsys-Ansys, Cadence (Clarity/Celsius/Voltus/Fidelity + Hexagon DEC), and Siemens (Calibre 3DStress). GPU-accelerated EDA (Cadence Millennium, NVIDIA partnerships) shortens simulation turn-times.

**Hardware emulation/prototyping super-cycle.** Cadence Palladium Z3 had 'best quarter ever' in Q1 FY26; Synopsys ZeBu/HAPS strong. Hyperscaler verification of multi-billion-transistor SoCs requires emulators that retail for tens of millions per system — a quietly massive hardware revenue line embedded inside 'EDA'.

**Concentration & pricing power.** CDNS + SNPS + Siemens ≈ 74–75% of global EDA, ~80% in China before BIS rules. Three-way oligopoly with long sales cycles (multi-year ELAs) and >90% retention. Pricing rises with node complexity and AI-feature attach.

## Risks

- **China revenue exposure.** May 2025 BIS letters halted EDA exports to China; reversed July 2, 2025 after Beijing's rare-earth export squeeze. The episode showed both that (a) EDA is a strategic export-control lever the US will use, and (b) it can be reversed quickly when leverage flips. China is ~10–16% of CDNS/SNPS revenue. Future BIS actions remain a tail risk; the US-China rare-earth/EDA stalemate is unstable.
- **Chinese domestic substitution.** Empyrean Technology (FY2024 revenue 1.22B CNY, +21% YoY; added to US Entity List Dec 2024), Primarius, and Semitronix are still gap-laden — Empyrean is solid at 28nm and partial at 7nm/5nm, not at the 2nm cutting edge — but multi-year domestic investment is closing the gap. Loss of China share is a slow, structural headwind.
- **Design IP commoditization at hyperscalers.** Synopsys explicitly flagged FY2026 as 'transitional' for Design IP (-6.5% YoY) because NVIDIA, Google, Amazon are building proprietary CPU/GPU/NPU IP and increasingly proprietary interconnect IP that bypasses the SNPS catalog. ARC processor IP sale to GlobalFoundries is a tell. Interface IP (PCIe 8.0, 224G/448G SerDes, UCIe, HBM4) is still defensible but processor IP is contested.
- **Integration risk (SNPS+ANSS).** 2,000 layoffs in Apr 2026, integration costs above plan, customer-facing joint product not landing until H1 2026 / monetization FY27. Cultural fit between EDA-engineer DNA and mechanical/CAE-engineer DNA is non-trivial. Cadence is taking advantage with BETA CAE + MSC Software (Hexagon DEC) counter-moves.
- **Valuation.** CDNS P/E ~71×, SNPS premium to historical despite -7 to -11% YTD. Both priced for sustained Rule-of-50/60. Any AI-chip capex pause (hyperscaler digestion phase, macro recession) compresses multiples sharply because long-cycle ratable revenue is sticky on the downside but doesn't grow when new tapeouts slow.
- **AI commoditizing the EDA seat itself.** The bull case is that agentic AI lets fewer engineers do more, expanding seat economics. The bear case is that customers eventually demand outcome-based pricing or push proprietary in-house AI flows (NVIDIA already runs proprietary place-and-route via internal tools), eroding seat economics. Not visible in numbers yet, but a structural watch-item.
- **Siemens EDA wildcard.** As part of Siemens AG, it can absorb price wars and bundle Calibre with Xcelerator PLM at marginal cost — potential margin pressure on CDNS/SNPS in mid-market and automotive segments.

## Cross-cutting

- **→ Custom ASIC explosion (T-compute / hyperscaler XPU node):** Every hyperscaler chip program (Trainium 3, Maia 200, TPU v7, MTIA, Axion) is a multi-thousand-seat EDA engagement. The hyperscaler ASIC trend directly drives EDA backlog growth — both CDNS and SNPS cite hyperscaler custom silicon as the #1 IP/Core-EDA growth driver. This is the central feedback loop: more chip designers → more seats → more AI-tool attach → higher revenue per seat.
- **→ TSMC / advanced foundry node (T-manufacturing):** Cadence partnership covers TSMC N3/N2/A16/A14; Synopsys Fusion Compiler + PrimeTime achieved 100% usage on critical 2nm tapeouts. Foundry process certification = EDA tool requirement. As nodes shrink, EDA intensity rises super-linearly.
- **→ NVIDIA (T-compute):** Both CDNS (Mar 2026) and Siemens EDA (DAC 2025) embed NVIDIA NIM/Nemotron into AI flows; CDNS Millennium platform runs EDA workloads on Blackwell/Rubin GPUs. NVIDIA both sells silicon to EDA users and sells GPUs to EDA vendors — a double-sided dependency.
- **→ Multi-die / HBM / chiplet packaging:** Synopsys 3DIC Compiler, Cadence Integrity 3D-IC + Allegro X, Siemens Innovator 3D IC / Calibre 3DStress all aim at advanced packaging. UCIe/CXL/PCIe interface IP rides the same wave. Packaging substrate / CoWoS bottlenecks (T-supply) feed back to EDA via design complexity.
- **→ China export-control regime (T-geopolitics):** EDA is the most weaponizable layer of the AI stack short of EUV. BIS rules → Chinese domestic EDA acceleration (Empyrean, Primarius) → potential long-term loss of ~10–16% of CDNS/SNPS revenue. Pairs with US rare-earth dependence as the bilateral leverage axis.
- **→ Hyperscaler capex cycle (T-demand):** ~85% recurring/ratable revenue smooths short cycles, but new tapeout starts are tied to hyperscaler chip roadmaps. A capex digestion phase delays new EDA seat expansions. Backlog gives 18–24 months of visibility; beyond that, EDA growth tracks chip-design start volume.
- **→ Power/cooling (T-energy):** Multi-physics simulation (Ansys thermal, Cadence Celsius, Siemens Calibre 3DStress) is now mission-critical for liquid-cooled racks and HBM thermal management — EDA expansion into the datacenter physical layer is real.

## Sources

- [Cadence Reports First Quarter 2026 Financial Results](https://investor.cadence.com/news/news-details/2026/Cadence-Reports-First-Quarter-2026-Financial-Results/default.aspx)
- [Cadence Q1 FY 2026 Earnings — Futurum Group](https://futurumgroup.com/insights/cadence-q1-fy-2026-earnings-driven-by-agentic-ai-expansion-and-emulation-hardware/)
- [Cadence Design Systems Q1 2026 Earnings Highlights — GuruFocus](https://www.gurufocus.com/news/8821795/cadence-design-systems-inc-cdns-q1-2026-earnings-call-highlights-record-backlog-and-ai-innovations-drive-growth)
- [Synopsys closes $35bn acquisition of Ansys — DCD](https://www.datacenterdynamics.com/en/news/synopsys-closes-35bn-acquisition-of-ansys/)
- [Synopsys completes $35B Ansys deal — Manufacturing Dive](https://www.manufacturingdive.com/news/chip-design-software-maker-synopsys-completes-35b-deal-ansys/753321/)
- [Synopsys Layoffs: 2,000 Cuts After $35B Ansys Deal](https://tech-insider.org/synopsys-layoffs-2000-employees-ansys-acquisition-2026/)
- [Synopsys Q1 FY2026 Earnings — Futurum Group](https://futurumgroup.com/insights/synopsys-q1-fy-2026-earnings-highlight-eda-and-ansys-momentum/)
- [Synopsys Q1 FY2026 Analysis — Harianbasis](https://www.harianbasis.co/en/synopsys-earnings-analysis-ai-chips)
- [Cadence Cerebrus AI Studio product page](https://www.cadence.com/en_US/home/tools/digital-design-and-signoff/soc-implementation-and-floorplanning/cadence-cerebrus-ai-studio.html)
- [Cadence ChipStack AI Super Agent launch (Feb 2026)](https://www.cadence.com/en_US/home/company/newsroom/press-releases/pr/2026/cadence-unleashes-chipstack-ai-super-agent-pioneering-a-new.html)
- [Cadence + TSMC AI silicon collaboration (Apr 2026)](https://www.cadence.com/en_US/home/company/newsroom/press-releases/pr/2026/cadence-collaborates-with-tsmc-to-accelerate-design-of-next.html)
- [Cadence + NVIDIA agentic AI engineering solutions (Mar 2026)](https://www.cadence.com/en_US/home/company/newsroom/press-releases/pr/2026/cadence-and-nvidia-unveil-accelerated-engineering-solutions.html)
- [CadenceLIVE 2026 — Agentic AI and 3D-IC — Futurum](https://futurumgroup.com/insights/cadencelive-2026-can-agentic-ai-finally-crack-3d-ic-design-automation/)
- [Allegro X Design Platform — Cadence](https://www.cadence.com/en_US/home/tools/pcb-design-and-analysis/allegro-x-design-platform.html)
- [The Embrace of AI in Design Transforms Cadence — Next Platform](https://www.nextplatform.com/ai/2026/04/16/the-embrace-of-ai-in-design-transforms-cadence-and-its-customers/5217962)
- [Trump Administration EDA China Sales Halt — TechRepublic](https://www.techrepublic.com/article/news-trump-administration-us-chip-design-software-firms-stop-sales-china/)
- [U.S. Restricts EDA Software Sales to China — EE Times](https://www.eetimes.com/u-s-restricts-eda-software-sales-to-china/)
- [EDA Titans: How U.S. Export Controls Are Cementing Dominance — AInvest](https://www.ainvest.com/news/eda-titans-export-controls-cementing-era-dominance-2505/)
- [China EDA tool restrictions — winners and losers — TechNode](https://technode.com/2025/07/02/chinas-eda-tool-restrictions-winners-and-losers/)
- [U.S. lifts chip design ban on China — Sourceability](https://sourceability.com/post/why-the-u-s-lifted-its-design-ban-and-what-it-means)
- [Tech war: China's top three EDA firms — SCMP](https://www.scmp.com/tech/tech-war/article/3313069/tech-war-chinas-top-three-eda-firms-under-spotlight-after-us-ban-chip-design-tools)
- [Siemens EDA — SEMI](https://www.semi.org/en/technology-trends/topic/siemens-eda)
- [Top 7 EDA Software Tools — Verified Market Research](https://www.verifiedmarketresearch.com/blog/top-electronic-design-automation-software/)
- [EDA Market Primer — SemiAnalysis](https://newsletter.semianalysis.com/p/eda-market-primer)
- [AI EDA Market Report 2026–2032 — MarketsandMarkets](https://www.marketsandmarkets.com/Market-Reports/ai-eda-market-212473295.html)
- [Cadence vs Synopsys Comparison — AAII](https://www.aaii.com/investingideas/article/26731-which-is-a-better-investment-cadence-design-systems-inc-or-synopsys-inc-stock)
- [Synopsys 10-Q FY2026 (Apr 30, 2026) — SEC](https://www.sec.gov/Archives/edgar/data/0000883241/000088324126000018/snps-20260430.htm)

_new_nodes_suggested: [
  {"id": "T1a", "title": "Hardware emulation (Palladium Z3, ZeBu) — verification capex", "why": "Multi-tens-of-millions-per-system emulators are a quietly massive hardware line inside 'EDA' and uniquely tied to hyperscaler verification spend"},
  {"id": "T1b", "title": "Interface/foundation IP (PCIe 8.0, UCIe, 224G SerDes, HBM4 PHY)", "why": "Distinct from processor IP — defensible silo where SNPS/CDNS still win even as hyperscalers go proprietary on CPU/GPU IP"},
  {"id": "T1c", "title": "GPU-accelerated EDA (Cadence Millennium, NVIDIA partnerships)", "why": "EDA workloads moving from CPU farms to GPU clusters — creates a feedback loop where NVIDIA sells GPUs to EDA vendors who sell tools to NVIDIA's competitors"},
  {"id": "T1d", "title": "Chinese domestic EDA (Empyrean, Primarius, Semitronix)", "why": "Slow-moving structural challenger; pace of node coverage gap-closing is the key indicator for long-run CDNS/SNPS China revenue"},
  {"id": "T1e", "title": "Multi-physics signoff for 3D-IC (Ansys + Cadence Clarity/Celsius + Siemens Calibre 3DStress)", "why": "Thermal/EM/stress signoff is becoming mandatory at 2.5D/3D — distinct moat layer separable from RTL-to-GDSII flow"},
  {"id": "T1f", "title": "Agentic AI design platforms (ChipStack, AgentEngineer, EDA AI System)", "why": "All three EDA majors are racing here; pricing model (seat + outcome) and customer adoption rate will determine whether AI is accretive or commoditizing"}
]

---

## DC siting + permitting + water

## Current state (May 2026)

Siting—not silicon, not capital—is now the binding constraint on AI datacenter buildout in the U.S. Every other node in the graph (chips, REITs, turbines, neoclouds) assumes a site exists with power, water, and political license. Each of those assumptions is failing somewhere right now.

### FERC interconnection queue
- ~10,300 active projects, ~1,400 GW generation + ~890 GW storage stuck in queues as of YE-2024 (the first capacity decline in a decade, largely a one-off as CAISO/PJM paused intake to digest backlog).
- Average wait time roughly doubled to ~5 years; only ~14% of queued projects ever reach commercial operation (LBNL).
- **FERC Order 2023 + 2023-A** (effective Nov 2023) replaced serial study with cluster studies ("first-ready, first-served"), imposed firm deadlines + penalties on RTOs, raised site-control/financial deposit thresholds. Industry view: a floor, not a ceiling; it doesn't fix the underlying lack of transmission.
- **PJM** told FERC its existing process complied with Order 2023; FERC partially disagreed in 2025, gave PJM 60 days to refile, and PJM is now working through ~63 GW of additional requests through 2026. PJM 2025/26 capacity auction cleared 800% higher YoY; 2026/27 cleared another +22%—siting scarcity now showing up as a price signal.
- Grid Strategies (Nov 2025) projects >150 GW of additional capacity needed by 2030.

### State-level constraints
- **Virginia (Loudoun + state):** Loudoun killed by-right zoning for DCs in March 2025; every project now needs Special Exception review. Phase 2 standards drafting Oct 2025–Apr 2026, board adoption targeted Dec 2026. Loudoun legally cannot impose a true moratorium under Virginia law but is using zoning instead. Statewide, Gov. Spanberger (D) flipped the trifecta; HB 1515 (moratorium tied to grid interconnect availability) was carried over to 2027 session. HB 503 / SB 466 would codify that DCs alone pay for their incremental power infrastructure. Fairfax banned DCs within 1 mile of rail stations; Prince William raised DC equipment tax 72%.
- **Arizona (Phoenix/Mesa/Goodyear/Tucson):** Mesa, Avondale, Phoenix have all passed ordinances capping industrial water usage and requiring developers to bring supplemental supplies (Mesa large users have contributed ~7,800 acre-feet). Phoenix's Dec 2024 zoning steers DCs away from employment centers. Tucson is using water-use ordinances as a de facto siting ban (Project Blue was killed by resident protest, forcing developer to commit to zero-water cooling). Gov. Hobbs has proposed a ~1¢/gallon DC water surcharge. Actual industrial water in Phoenix is ~6% of potable usage; DCs are ~0.12% of Maricopa County daily water vs. 3.8% for golf courses—the political pressure is decoupled from the underlying numbers.
- **Georgia:** GA PSC (Jan 2025) approved Georgia Power tariff changes making DCs pay their own way; PSC froze base rates through 2028 (July 2025); PSC approved ~10 GW new generation in Dec 2025 (~90% earmarked for DCs)—now under legal challenge from SELC/Sierra Club. HB 1059 would impose a 1-year DC moratorium starting July 2026. Atlanta City Council banned DCs in the CBD/Beltline.
- **Texas (ERCOT):** SB 6 (signed Jun 2025) is the biggest single regulatory shift in the country. PUCT Project 58481 / draft rule 16 TAC §25.194 (published Mar 12, 2026) applies to any new or expanded load ≥75 MW: requires an intermediate agreement with proof of site control (5+ year lease beyond peak-demand date), $100K–$300K study fees + $50K/MW security, 20/80 refund split on withdrawal or missed milestones, and curtailment protocols. "Batch Zero" study process is ERCOT's response to 225 large-load requests in 2025 (vs. a system built for 40–50). Comment deadline Apr 17, 2026; final rule by mid-2026; full SB 6 rules suite (Projects 58479-58482) due by Dec 31, 2026.
- **Ohio (AEP/PUCO):** July 9, 2025 PUCO order approved AEP Ohio's data center tariff—DCs ≥25 MW must pay for 85% of contracted capacity regardless of usage, 4-yr ramp + 8-yr minimum, 3-yr exit penalty. PUCO denied AWS/Google/Meta rehearing in Sept 2025. April 1, 2026 rate case order extended the structure. OMA has signaled possible Ohio Supreme Court appeal. AEP saw DC load go 100 MW (2020) → 600 MW (2024); ~30 GW of interconnection requests outstanding.

### Water
- AI cooling shifted from open-loop evaporative to closed-loop / air-cooled in response to local pressure. Microsoft's Goodyear PHX-70/71 retrofit cancelled evaporative cooling (would have used 1.2M gal/day at full build-out, ~56M gal/yr) in favor of a "zero water" pilot; the new 6-Mar-2026 agreement committed Microsoft to $36M of the $90M 157th Ave wastewater plant expansion. Edged Phoenix advertises 138M gal/yr saved vs. evaporative.
- Hyperscaler 2030 "water-positive" pledges (MSFT, GOOG, AMZN, META) are increasingly seen as unfounded. Microsoft water use jumped 34% YoY 2021→2022 (1.7B gal); MSFT total emissions ~30% above 2020 baseline as of 2024. Critics note water offsets don't work like carbon offsets—a replenishment project in Wisconsin does nothing for an aquifer in Arizona.
- Average mid-size DC uses ~300M gal/yr; hyperscale can exceed 600M gal/yr in Texas (UT-Austin 2023 study).

### Land: power-dense brownfield premium
- Retired coal sites are the most valuable land in U.S. data-center real estate right now: they bring existing high-voltage substations, transmission interconnect, water rights, industrial zoning, and rail access—skipping ~5+ years of interconnect queue.
- Reference deals: TeraWulf Lake Mariner (retired coal in NY, 750 MW future load, $290M deployed in 12 months, adjacent to two 345 kV lines + Niagara/Quebec hydro); Aligned Conesville (197 acres adjacent to former AEP Conesville coal plant, first DC online mid-2026); TerraPower's Wyoming nuclear project at a former coal site.
- Nuclear-adjacent restarts: Three Mile Island (Constellation/Microsoft, 800+ MW). FERC blocked the original Talen-AWS Susquehanna BTM expansion 300 → 480 MW in Nov 2024; rejected rehearing; Talen restructured as a front-of-meter 1,920 MW PPA through 2042 (~$18B revenue), going live with the spring 2026 refueling outage. **The BTM-at-an-existing-nuclear-plant model is effectively dead at FERC; FTM-with-retail-provider is the workaround.**
- Permian Basin / stranded gas: 12 announced projects claiming >40 GW (more than ERCOT's current peak). Chevron–Engine No.1–Microsoft (2.5 → 5 GW, ~$7B, FID by early 2026, online 2027). Pacifico GW Ranch (TCEQ permit 26-Jan-2026 for up to 7.65 GW on 8,000 acres in Pecos County—largest power-generation air permit in U.S. history). Energy Transfer–Oracle (~900,000 Mcf/d). FO Permian Partners (5+ GW off-grid). Waha gas summer 2026 strip ~ -$4/MMBtu basis. Most pitches don't have permits/EPC/offtake—the thesis is real, most decks are not.

### Permitting reform
- **SPEED Act** (Westerman R-AR + Golden D-ME) passed House 221–196 (Mar 2026): 150-day NEPA challenge window, faster court timelines, fewer NEPA-triggering situations. Senate has not introduced a companion; R Street estimates 20-30% odds of passage in 2026.
- Other live bills: RED Tape Act (passed House, in Senate), PERMIT Act, ESA Amendments Act, Gottheimer Grid Expansion & Reliability Act (would give FERC NIETC designation authority + self-certification within corridors).
- CEQ's authority to issue NEPA rules has been stripped (Trump admin); agencies now interpret individually. Combined with *Seven Counties* and *Loper Bright*, this materially narrows NEPA litigation surface.
- DOE federal-lands data-center program: 4 sites announced July 28, 2025 — Idaho National Lab (44,000 acres + pre-permitted for new reactors), Oak Ridge (245 acres, 500 kV TVA + 5 mi from Clinch River SMR site, up to 800 MW), Paducah Gaseous Diffusion Plant (still in environmental cleanup), Savannah River (250–450 acres of a 3,100-acre tract). Selections rolling through 2026 (INL announced Dec 2025; Paducah RFP due Jan 30, 2026). EO threshold: 100 MW + $500M capex.

### Local-government pushback
- **$64B of DC projects blocked or delayed** in the last two years (Data Center Watch): $18B fully blocked, $46B delayed.
- Tax abatement repeal momentum: Virginia Senate voted to end the projected $1.6B/yr DC sales-tax exemption. Arizona, Illinois, Arkansas have passed restrictions; SC considering ending discounted power rates; GA's 2-yr abatement moratorium was vetoed by Gov. Kemp under Data Center Coalition lobbying. At least 300 DC-related state bills filed across 30+ states in early 2026.
- The politics has shifted from "NIMBY" to what VA Sen. Obenshain called "BANANA" (Build Absolutely Nothing Anywhere Near Anything)—and it cuts across party lines (left = environment, right = tax abatement giveaways), which is what makes it durable.

## Strategic position

**Siting is now a financial moat, not a regulatory checkbox.** The marginal AI gigawatt in 2026 cannot be sited via the traditional model (greenfield + utility tariff + tax abatement). It must come from one of four routes, each with a different gatekeeper:

1. **Brownfield coal/nuclear-adjacent** — gatekeeper is the asset owner (NRG, Vistra, Constellation, TVA, AEP). Already priced in; remaining inventory is shrinking and being optioned.
2. **Permian/stranded-gas BTM** — gatekeeper is the midstream/E&P operator (Chevron, Energy Transfer, FO Permian). Cheap power, weak environmental scrutiny, but most pitches lack permits/offtake/EPC.
3. **Federal lands (DOE 4-site program + future BLM)** — gatekeeper is the U.S. government. Real but slow; only INL is at scale today.
4. **Front-of-meter retail PPAs at incumbent nukes** (Talen-AWS template) — gatekeeper is the state PUC + RTO. Workaround for FERC's BTM rejection; replicable wherever a host utility is willing.

The winners are entities that can underwrite siting risk at speed: vertically-integrated developers (Crusoe, TeraWulf, Aligned), incumbent IPPs with nuclear/coal assets, and midstreams with land + gas in the Permian. Conventional hyperscaler colos in T1 metros (Loudoun, Phoenix, Atlanta) face escalating tariffs, special-use review, and water surcharges that meaningfully raise effective $/kW-yr.

**The graph's existing P4/P5 nodes (cooling, REITs, turbines, transformers) all assume siting is solvable. It isn't, uniformly.** Siting friction is now what determines which neocloud projects get built, which REITs can pre-lease, and where the next 100 GW of gas turbines actually go.

## Risks

- **Reform passage:** SPEED Act / transmission permitting reform has only ~20-30% odds in 2026; without it, FERC Order 2023 plus state-level reforms are insufficient.
- **State patchwork divergence:** OH/TX/GA all picked different models (minimum-take tariff vs. ERCOT security deposit vs. PSC freeze + new generation approval). National hyperscalers must underwrite N different regulatory regimes; this favors regionally-focused operators.
- **Water political risk is asymmetric:** Even though DCs are a tiny fraction of water use in places like Maricopa County, the optics around evaporative cooling drive policy. One viral incident in a drought year can produce a Tucson-style ban.
- **BTM legal closure:** FERC's Talen rejection means BTM-at-an-IPP-nuclear plant is effectively closed without a special contract; future hyperscaler nuclear deals must go FTM, raising cost and timeline.
- **NEPA + tax abatement repeal in VA:** If Virginia ends the DC sales tax exemption, ~$1.6B/yr in incentives evaporates; could rebalance the Northern Virginia vs. Columbus/Atlanta/Phoenix tradeoff.
- **Permian gas optionality:** ~40 GW of announced gas projects vastly exceeds what is permitted + financed; the "stranded gas to data center" narrative is overbuilt at the deck level even if the underlying physics is sound.
- **Midterm elections:** Bipartisan NIMBY backlash means even Republican strongholds (TX, GA) face primary challenges to pro-DC incumbents; could freeze further state-level incentive programs.

## Cross-cutting

What this node gates in the existing graph:

- **P4 (power distribution / transformers / substations):** Order 2023 cluster studies + state-level study fees (TX SB 6 $50K/MW) mean transformer/substation demand is concentrated at brownfield + BTM sites, not greenfield. Gating supply: which projects clear the queue determines transformer order timing.
- **P5 (turbines / gas-fired generation):** Permian BTM gas, Texas SB 6, and FERC's BTM rejection redirect ~40 GW of announced gas turbines toward FTM tariff structures or off-grid Permian projects. Permitting bottleneck for turbines is TCEQ air permits + local opposition, not just turbine OEM lead times.
- **REITs / hyperscaler colos (existing physical-buildout node):** Loudoun/Phoenix/Atlanta tightening means pre-leasing assumes regulatory risk that REITs historically haven't priced. Power-dense brownfield premium is showing up as a 2-3× $/MW land premium for sites with existing interconnect.
- **Neoclouds:** Their thesis ("we're faster than hyperscalers") only holds where siting is solvable—mostly Permian/brownfield. Where it isn't (NoVA, Phoenix urban), neoclouds face the same gates as hyperscalers.
- **Energy supply / grid:** FERC Order 2023's interconnection reform sets the timing for generation projects that DCs need; PJM cleared 800% / +22% capacity auctions are the price-signal evidence that supply isn't catching up.
- **Nuclear restart node:** Talen FTM workaround template is now the standard for nuclear-adjacent deals; this gates how quickly Three Mile Island / Palisades / Duane Arnold restarts can monetize via DC PPAs.

## Sources
- [FERC Order 2023 Explainer](https://www.ferc.gov/explainer-interconnection-final-rule)
- [LBNL Queued Up — Characteristics of Power Plants Seeking Transmission Interconnection](https://emp.lbl.gov/queues)
- [Utility Dive — FERC orders changes to PJM's interconnection process](https://www.utilitydive.com/news/ferc-pjm-grid-interconnection-queue-christie/754050/)
- [Perkins Coie — FERC Upholds Interconnection Reforms](https://perkinscoie.com/insights/update/ferc-upholds-reforms-interconnection-process-will-reforms-be-implemented-fast)
- [Loudoun County — Data Center Standards & Locations](https://www.loudoun.gov/5990/Data-Center-Standards-Locations)
- [MultiState — State Data Center Legislation in 2026](https://www.multistate.us/insider/2026/2/20/state-data-center-legislation-in-2026-tackles-energy-and-tax-issues)
- [Cardinal News — Virginia data center bills under new governor](https://cardinalnews.org/2026/02/03/new-governor-could-see-new-versions-of-old-bills-seeking-to-regulate-the-data-center-industry/)
- [Grist — Arizona's water is drying up. That won't stop its data center rush.](https://grist.org/technology/arizona-water-data-centers-semiconducters/)
- [Snell & Wilmer — Arizona Data Center Boom, Federal EOs, State Regulation](https://www.swlaw.com/publication/building-in-arizonas-data-center-boom-how-federal-executive-orders-state-regulation-and-national-security-policy-are-reshaping-the-rules-for-developers/)
- [Mesa Tribune — Data centers including those in Mesa pose big challenges](https://www.themesatribune.com/news/data-centers-including-those-in-mesa-pose-big-challenges-for-state/article_0de7f2b4-3356-40d7-a16e-fd2c53575605.html)
- [Microsoft Local — Goodyear water agreement](https://local.microsoft.com/blog/understanding-microsoft-datacenters-in-west-valley/)
- [Power Magazine — Talen Amazon $18B Nuclear PPA grid-connected IPP model](https://www.powermag.com/talen-amazon-launch-18b-nuclear-ppa-a-grid-connected-ipp-model-for-the-data-center-era/)
- [Utility Dive — FERC rejects Talen-Amazon interconnection pact](https://www.utilitydive.com/news/ferc-interconnection-isa-talen-amazon-data-center-susquehanna-exelon/731841/)
- [Data Center Frontier — Talen Energy continues BTM fight](https://www.datacenterfrontier.com/energy/article/55264293/talen-energy-continues-behind-the-meter-power-fight-for-aws-data-center-campus)
- [Georgia PSC — Data Center Fact Sheet (Mar 2026)](https://psc.ga.gov/site/downloads/datacenterfactsheet.pdf)
- [GovTech — Georgia approves rule to charge data centers for power](https://www.govtech.com/products/georgia-approves-new-rule-to-charge-data-centers-for-power)
- [Greenberg Traurig — Texas SB 6 / proposed interconnection standards](https://www.gtlaw.com/en/insights/2026/3/texas-senate-bill-6-update-what-data-centers-large-load-customers-should-know-about-proposed-interconnection-standards)
- [DLA Piper — Texas new interconnection standards for large electric loads](https://www.dlapiper.com/en-us/insights/publications/2026/03/texas-proposes-new-interconnection-standards-for-large-electric-loads)
- [Texas Tribune — ERCOT new way to consider data centers](https://www.texastribune.org/2026/01/19/ercot-texas-data-centers-electricty-demand/)
- [Data Center Frontier — Ohio sets new precedent: AEP's power rules](https://www.datacenterfrontier.com/energy/article/55304787/ohio-sets-new-precedent-aeps-power-rules-shift-data-center-cost-burden)
- [Vorys — PUCO authorizes AEP Ohio data center tariff](https://www.vorys.com/publication-public-utilities-commission-of-ohio-authorizes-tariff-for-aep-ohios-data-center-customers-requires-end-of-moratorium-on-new-services-for-data-centers)
- [NBC4 — PUCO rejects bid to overturn AEP rate structures](https://www.nbc4i.com/news/state-news/puco-rejects-bid-to-overturn-aeps-new-rate-structures-for-large-data-centers/)
- [C&EN — Bipartisan permitting reform drive grows](https://cen.acs.org/articles/104/web/2026/05/permitting-reform-nepa-esa-energy-renewable-pipeline.html)
- [Utility Dive — Why the SPEED Act may slow down in the Senate](https://www.utilitydive.com/news/senate-permitting-reform-speed-act/808471/)
- [NLC — EPA reuse considerations for data centers on brownfield/Superfund sites](https://www.nlc.org/article/2026/03/31/understanding-epas-reuse-considerations-for-data-centers-on-brownfield-and-superfund-sites/)
- [Landgate — Mapping retired coal & nuclear sites for data centers](https://www.landgate.com/news/mapping-retired-coal-nuclear-sites-for-data-centers)
- [Data Center Frontier — TeraWulf Lake Mariner: retired coal plant as AI factory prototype](https://www.datacenterfrontier.com/site-selection/article/55379784/terawulfs-lake-mariner-campus-how-a-retired-coal-plant-became-an-ai-factory-prototype)
- [Davis Graham — Trump Administration progress siting DCs on federal lands](https://davisgraham.com/news-events/the-trump-administrations-progress-to-site-data-centers-on-federal-lands-initial-steps-but-work-remains/)
- [DOE — Site selection for AI data center on federal lands](https://www.energy.gov/articles/doe-announces-site-selection-ai-data-center-and-energy-infrastructure-development-federal)
- [Bracewell — Permian Basin DCs tapping associated natural gas](https://www.bracewell.com/news-events/stranded-no-more-permian-basin-data-centers-tapping-associated-natural-gas-for-on-site-power/)
- [Data Center Frontier — Powering AI in the Permian (TCDC)](https://www.datacenterfrontier.com/site-selection/article/55289667/powering-ai-in-the-permian-texas-critical-data-centers-sustainable-energy-play)
- [DCD — FO Permian 5GW off-grid gas](https://www.datacenterdynamics.com/en/news/fo-permian-partners-unveils-5gw-off-grid-gas-power-solution-for-texas-data-centers/)
- [Electroneconomics — The Permian data center thesis is real, most decks are not](https://electroneconomics.substack.com/p/the-permian-data-center-thesis-is)
- [Oil & Gas Watch — Massive gas-powered DC in Permian Basin](https://news.oilandgaswatch.org/post/massive-gas-powered-data-center-in-permian-basin-is-latest-in-string-of-texas-ai-computing-hubs)
- [Data Center Watch — $64B of DC projects blocked or delayed](https://www.datacenterwatch.org/report)
- [Fortune — Grassroots NIMBY revolt in Republican strongholds](https://fortune.com/2025/12/16/ai-data-center-backlash-republican-strongholds/)
- [Stateline — DC tax breaks on the chopping block](https://stateline.org/2026/02/24/data-center-tax-breaks-are-on-the-chopping-block-in-some-states/)
- [Washington Times — Virginia debates scrapping DC tax breaks](https://www.washingtontimes.com/news/2026/mar/11/virginia-data-center-boon-officials-debating-whether-time-scrap-tax/)
- [Trellis — AI backlash focused on data centers / Microsoft water gap](https://trellis.net/article/data-centers-ground-zero-ai-backlash-what-must-change/)
- [BHRRC — Amazon, Google, Microsoft DCs in driest regions](https://www.business-humanrights.org/en/latest-news/amazon-google-microsoft-allegedly-operating-and-expanding-water-intensive-datacentres-in-some-of-the-worlds-driest-region/)

## _new_nodes_suggested
- **L2: Brownfield-site M&A and option premium** — track who is buying retired coal/nuclear-adjacent land (Aligned, TeraWulf, Crusoe, Constellation, Vistra, NRG, AEP) and the $/MW interconnect premium. This is a quasi-private market with deal flow but no public index.
- **L3: State DC tariff regime tracker** — comparative matrix of OH-style minimum-take, TX SB 6 deposits, GA PSC cost-causation, VA tax-abatement repeal status. Feeds neocloud + REIT underwriting models.
- **L4: Federal lands + DOE 4-site program** — INL/Oak Ridge/Paducah/Savannah River selection cadence, lease terms, capacity allocation. Distinct from BLM-led oil/gas leasing path.
- **L5: NIETC + transmission permitting reform** — Lake Erie–Canada, Southwestern Grid Connector, Tribal Energy Access; FERC self-certification proposals. Gates how fast new gen + DC corridors can connect.
- **L6: Water-cooling technology transition** — Edged/closed-loop/dry cooling vs. evaporative; who is mandated to retrofit (MSFT Goodyear), who is incentivized (AZ surcharge), who isn't (Permian off-grid).
- **L7: BTM legal regime post-Talen** — track future BTM filings at FERC and the FTM-retail-provider workaround template (Talen-AWS as canonical reference deal).
- **L8: Local opposition / political risk index** — county-by-county tracking of moratoriums, recalls, special-exception denials, à la Data Center Watch's $64B blocked/delayed metric.

---

## Regulated utilities serving DCs

## Current state (May 2026)

Regulated investor-owned utilities (IOUs) and public power entities that physically serve datacenters are experiencing the largest demand-driven rate-base expansion in 40+ years. Unlike merchant IPPs, these entities earn an allowed return on equity (typically 9.5-10.5%) on every dollar of approved capex, so DC-driven load growth translates directly into rate-base growth and EPS growth subject to state PUC approval.

**Dominion Energy (NYSE: D) — Virginia / PJM-DOM zone.** The single most exposed name. Loudoun/Prince William counties host ~70% of global DC capacity. Contracted DC capacity went from ~21 GW (Jul 2024) to ~40 GW (Dec 2024) to 47.1 GW (Oct 2025). Total inquiries/requests reached ~70 GW by late 2025 — roughly 3x Dominion's current peak load. 2025 IRP forecasts 16.6 GW of *forecast* demand by 2046 (vs. higher contracted figure). Five-year capex raised to $50.1B (2025-2029), +16% YoY, with $17B explicitly DC-linked. Dominion's 20-year summer peak grows +70% (2022-2045). NextEra announced an all-stock acquisition of Dominion for ~$67B on May 18, 2026 — if approved, creates the dominant US DC-utility platform.

**Oncor (Sempra subsidiary) — Texas / ERCOT.** Fully wires-only T&D (no generation). 2026-2030 base capex plan $47.5B (~$9-10B/yr). Year-end 2025 LC&I interconnection queue: 650 requests, ~255 GW from DCs + 18 GW other industrial. ~38 GW currently qualifies for Apr 1, 2026 RTP filing to ERCOT. NPR (May 2026) cited 127 GW filed over the next decade. CEO is Allen Nye (not Karen Brown — that name was incorrect in the prompt; Karen Sedgwick is Sempra CFO).

**AEP (American Electric Power, NYSE: AEP) — owns the largest US transmission network including ~2,100 miles of 765 kV (≈90% of all US 765 kV).** 5-year capex raised to $78B (2026-2030), $33B (42%) of which is transmission. Targeting ~11% rate-base CAGR, >9% EPS CAGR through 2030. 24 GW of committed new load + ~190 GW of additional active interest (5x current 37 GW system). AEP Texas load commitments alone went from 13 GW to 36/41 GW; SB6 (TX) summer 2026 is expected to firm interconnection certainty. Building 315 mi of new 765 kV in SPP plus ~330 mi in PJM (OH/IN).

**TVA (Tennessee Valley Authority) — federal corporate agency, not investor-owned.** Major hyperscale pipeline in TN/AL/MS. Google–Kairos Power–TVA PPA (Aug 2025): Hermes 2 SMR in Oak Ridge will deliver up to 50 MW (first US utility purchase of advanced Gen-IV nuclear power), supporting Google DCs in Montgomery County TN and Jackson County AL — first step toward 500 MW Kairos/Google by 2035. TVA exploring restart/expansion at Clinch River and additional SMR siting; nuclear-led capacity expansion is the strategic differentiator since TVA is debt-cap constrained rather than ROE-driven.

**PacifiCorp (Berkshire Hathaway Energy) — multi-state West.** Under strain. Selling Washington operations to Portland General Electric (PGE) + Manulife/John Hancock for $1.9B (announced Feb 17, 2026; 1.4x 2026 rate base) — PacifiCorp itself cited multi-state policy divergence and credit/financial pressure. Amazon filed a complaint at Oregon PUC alleging PacifiCorp failed to deliver power to AWS Boardman/Hermiston-area campuses. Berkshire's regulated utility moat is unusually weak here.

**Portland General Electric (NYSE: POR).** Quietly emerging DC name. Executed 5 DC contracts for 430 MW in 2025-early 2026; targets 5-7% EPS growth, 10%+ CAGR in industrial load. PacifiCorp WA acquisition lifts rate base ~18% to ~$9B and adds 140k customers.

**NV Energy (Berkshire Hathaway Energy) — Nevada.** DCs already ~22% of state electricity demand. 2026 IRP filed at PUCN; ~12 known facilities aggregate to ~5,900 MW. Tahoe-Reno Industrial Center (TRIC) hosts Switch, Google, Microsoft. Amazon deal: 100 MW Zanskar geothermal + 600 MW solar + 600 MW battery (Primergy) — first AWS DC partly geothermal-powered.

**Entergy (NYSE: ETR) — Louisiana / Mississippi / Arkansas / east TX.** Four-year capex $57B with $27B for new generation (up >30% in a single quarter). $14B explicitly for Meta's Hyperion 5 GW campus in Richland Parish, LA — Entergy filed for 7 new CCGT units (>5.2 GW), 240 mi of 500 kV, and battery storage; combined with 3 previously-approved units this would reach ~7.5 GW of gas to serve Meta (>30% of LA's current grid). Meta signed an updated cost-of-service deal (Mar 2026) preserving ~$2.65B of customer savings over 20 years. MS legislature passed pre-certification statute enabling AWS $10B build. Also serving 1.4 GW Oracle DC and contracted 1 GW Google.

**NextEra Energy (NYSE: NEE).** Both a regulated utility (FPL) and the largest US IPP/renewables developer. FPL DC pipeline: 21 GW, NEE advanced on >50% of it. NEER backlog ~33 GW. Picked by US DoC under US-Japan $550B deal to develop, build, and operate 9.5 GW of gas in TX and PA for large-load customers. Google partnership: ~15 GW of new generation by 2035. Pending acquisition of Dominion (announced May 18, 2026, $67B all-stock) would create the country's flagship DC utility.

**Eversource (NYSE: ES).** Notable counter-positioning. CEO Joe Nolan publicly said he is "not interested" in DCs — they are "only going to drive up the price of energy" and "of no value to our residential customer." $26.5B 5-yr capex against $49.3B 2030 rate base, but minimal DC exposure relative to peers.

**AES Corp (NYSE: AES).** Hybrid IPP/utility. Owns regulated utilities in IN (AES Indiana) and OH (AES Ohio) but most relevance is contracted-renewables for hyperscalers (Google, Microsoft, AWS PPAs). Lower rate-base DC story than the pure IOUs above; closer in profile to a clean-power developer.

## ISO/RTO context

- **PJM** (Mid-Atlantic + parts of Midwest): DC load = 40% of capacity costs in the Dec 2025 BRA for 2027/2028 delivery year. Capacity hit price cap of $333.44/MW-day (without the PA-Shapiro cap it would have been ~$530). PJM cleared 145,777 MW — ~6,625 MW *below* reliability target for the first time. DC-attributable load over the last 3 auctions added ~$23.1B of capacity revenue and ~$13.8B of customer bill impact. PJM Board (Jan 16, 2026) issued plan to address large-load surge; 13 PJM governors committed to allocate costs to DCs.
- **ERCOT** (Texas): no capacity market; energy-only with scarcity pricing. Texas SB6 (effective summer 2026) standardizes large-load interconnection. Wires utilities (Oncor, AEP Texas, CenterPoint) earn rate-base return; generation is competitive.
- **MISO** (Midcontinent): Entergy operates here; large-load pipeline expanding fast in LA/MS/AR.
- **SPP** (Southwest Power Pool): AEP building 765 kV expansion; Oklahoma/Louisiana DC interest.
- **WECC / CAISO / non-RTO West**: PacifiCorp, NV Energy, PGE operate inside or adjacent to CAISO Western EIM/EDAM and bilateral markets.

## Strategic position

- **Business model.** Regulated utility = state PUC-approved revenue requirement = (rate base × allowed ROE) + opex + taxes. DC capex grows the rate base; every approved dollar earns ~9.5-10.5% ROE for ~30-40 yrs. DC growth ends a 15-20 year era of ~0% load growth and converts utilities from "bond proxy" income stocks back into growth-utilities.
- **Cost-of-service tariffs.** Hyperscalers usually pay their full incremental cost via minimum bills, take-or-pay, and contract terms (e.g., Meta-Entergy LA, FPL data-center tariff). This protects residential ratepayers and is the political foundation for PUC approval of large generation builds.
- **T&D specialists vs. vertically integrated.** Oncor / AEP Transmission are pure wires plays — exposed to transmission rate-base growth without generation policy risk. Dominion / Entergy / NextEra-FPL / NV Energy / PacifiCorp own the generation side too, capturing more capex but bearing more fuel/policy exposure.
- **Public power / federal entities (TVA, MEAG, public IOUs).** Compete via tax-exempt debt and federal preference power; nuclear-led strategy at TVA makes it the cleanest large-DC utility in the SE.
- **M&A consolidation.** NEE-Dominion (announced May 18, 2026) and PacifiCorp divestitures suggest scale and balance-sheet capacity are decisive in the DC era. Expect more.

## Risks

- **Forecast overstatement.** Monitoring Analytics (PJM market monitor) warns DC load forecasts are "extreme uncertain" and may be double-counted (same project shopping multiple utilities). If real DC load lands at half of contracted, utilities risk stranded gas/transmission assets and PUC disallowance.
- **Cost-shift backlash.** Oregon created the first DC-specific rate class. VA SB 253 attempts to shift distribution and capacity costs to DCs. PA PUC issued a Large Load Tariff Framework (Apr 30, 2026). At least 6 states moving on DC construction moratoriums; 7 reviewing tax incentives. ~60 large-load tariffs proposed nationwide per SEPA.
- **Capital allocation discipline.** $57B Entergy, $78B AEP, $50B Dominion, $47.5B Oncor — these are unprecedented capex programs. Execution risk on supply chain (GE Vernova turbines into 2028+, transformers 3-4 yr lead, HV cable shortages).
- **Behind-the-meter / co-located bypass.** Hyperscalers increasingly pursue private generation (e.g., Meta-Beignet SPV with Blue Owl, Talen-AWS Susquehanna, ERCOT-style direct gas) which bypass utility rate base. Disputed FERC docket on co-location is the key policy battleground.
- **PJM capacity-market dysfunction.** Three consecutive record-cap auctions; reliability shortfall in Dec 2025 BRA prompted FERC alarm. Risk: federal/state pressure forces structural changes (re-regulation, capacity carveouts, generation rate-basing) that change the utility return profile.
- **PacifiCorp-style multi-state friction.** Diverging state IRPs (e.g., WA/OR/CA vs. UT/WY/ID) can erode credit and force divestitures.
- **Federal/state jurisdictional fights.** DOE large-load interconnection proposal (2026) overlaps FERC/NARUC turf; litigation risk.
- **Affordability politics.** PJM residential bill increases attributable to DCs (~$13.8B over 3 auctions) feed governor-level intervention (e.g., PA-Shapiro cap), capping utility upside.

## Cross-cutting

- **vs. IPPs (Constellation, Vistra, Talen).** IPPs sit on the merchant side of the meter — they own generation that sells into wholesale markets or signs PPAs (often to DCs directly). Regulated utilities sit on the wires/load side and earn rate-base returns. Frequently both sides of the same meter: e.g., Constellation's Three Mile Island restart sells to Microsoft via the PJM grid that Exelon Pennsylvania (regulated) operates; Talen's Susquehanna feeds AWS Cumulus via PPL transmission; Vistra's nuclear fleet plays into ERCOT served by Oncor/AEP-TX wires. The deregulated-vs-regulated split (PJM Ohio/Illinois/Texas/PA = deregulated generation; Virginia/Indiana/Mississippi/Louisiana/Georgia = regulated) determines which entity earns the rate-base return.
- **vs. grid hardware (GE Vernova, Hitachi Energy, Eaton).** Utilities are the buyers of large transformers, 765 kV breakers, HVDC converters, gas turbines. Multi-year backlog at GEV/Hitachi means utility capex schedules are now equipment-constrained.
- **vs. E3 (consultants / forecasting).** E3 (Energy and Environmental Economics) authors Large Load Tariff Whitepaper (May 2026) and supports PUC rate-design across the country — sits as advisor to both DCs and utilities, often setting the analytical frame for cost-allocation fights. Halcyon (E3 data partner) is the principal aggregator of large-load tariff filings.
- **vs. SMR/nuclear (Kairos, X-energy, NuScale).** Regulated utilities are now natural off-takers: TVA-Kairos (50 MW, scaling to 500 MW), Dominion exploring SMRs at North Anna, Entergy MOU for nuclear in LA. Rate-base recovery of construction work in progress (CWIP) is the policy lever that determines whether SMRs get built through utilities or merchant.
- **vs. hyperscaler DC pipeline (Meta, Google, MSFT, AWS, Oracle).** Each hyperscaler-utility deal (Meta-Entergy LA, Google-TVA-Kairos, AWS-NV Energy, AWS-PacifiCorp dispute, Oracle-Entergy, FPL-NEE) anchors several years of capex for the host utility.
- **vs. PJM/ERCOT/MISO ISO governance.** ISO interconnection queues, capacity auction rules, and large-load tariff frameworks are the cost-allocation battlefield where utility EPS upside is divided between shareholders, hyperscalers, and residential ratepayers.

## Sources
- [Dominion nearly doubles DC capacity under contract to 40 GW (DCD)](https://www.datacenterdynamics.com/en/news/dominion-energy-nearly-doubles-data-center-capacity-under-contract-to-40gw/)
- [Dominion long-range projections show major energy growth (Virginia Mercury, Oct 2025)](https://virginiamercury.com/2025/10/22/dominion-long-range-projections-show-major-energy-growth-what-it-takes-to-fully-comply-with-vcea/)
- [Dominion prepares for 70,000 MW in DC demand (Virginia Business)](https://virginiabusiness.com/dominion-data-center-power-demand-virginia-scc/)
- [Dominion Energy 2026 Pivot (EnkiAI)](https://enkiai.com/data-center/dominion-energys-2026-pivot-taming-data-center-demand/)
- [Dominion DC large load adjustment, PJM Manual 19 Attachment B](https://www.pjm.com/-/media/DotCom/planning/res-adeq/load-forecast/dominion-documentation.pdf)
- [Oncor reports 2025 results; announces $47.5B 2026-2030 capital plan](https://www.oncor.com/content/oncorwww/wire/en/home/newsroom/ONCOR-REPORTS-2025-RESULTS---ANNOUNCES--47-5-BILLION-2026-2030-BASE-CAPITAL-PLAN.html)
- [Oncor 200 GW interconnection requests (Utility Dive)](https://www.utilitydive.com/news/oncor-sempra-interconnection-texas-data-center-earnings/757262/)
- [Can Texas' grid handle DCs? (NPR, May 22 2026)](https://www.npr.org/2026/05/22/nx-s1-5826894/can-texas-power-grid-handle-the-demands-of-data-centers)
- [AEP capex surges 33% to $72B (Utility Dive)](https://www.utilitydive.com/news/aep-data-centers-rates-earnings/804228/)
- [AEP Q1 2026 8-K press release](https://www.sec.gov/Archives/edgar/data/0000004904/000000490426000031/a1q20268kpressreleaseex991.htm)
- [AEP targets AI DC growth with expanded capex (Yahoo)](https://finance.yahoo.com/news/american-electric-power-targets-ai-091010143.html)
- [AEP $78B plan (Alphastreet)](https://news.alphastreet.com/american-electric-power-aep-beats-q1-2026-estimates-as-data-center-demand-drives-78-billion-capital-plan/)
- [Google, Kairos Power, TVA collaborate (Kairos Power)](https://kairospower.com/external_updates/google-kairos-power-tva-collaborate-to-meet-americas-growing-energy-needs)
- [TVA-Kairos 50 MW PPA for Google DCs (DCD)](https://www.datacenterdynamics.com/en/news/tva-signs-50mw-ppa-with-smr-developer-kairos-for-google-data-centers-in-tennessee-and-alabama/)
- [PGE buys PacifiCorp Washington operations $1.9B (Utility Dive)](https://www.utilitydive.com/news/pge-portland-general-pacificorp-washington-utility/812422/)
- [Amazon says PacifiCorp not providing power to Oregon DCs (DCD)](https://www.datacenterdynamics.com/en/news/amazon-says-utility-pacificorp-isnt-providing-enough-power-to-oregon-data-centers/)
- [Berkshire Hathaway Energy 10-Q Q1 2026](https://www.sec.gov/Archives/edgar/data/0001081316/000108131626000013/bhe-20260331.htm)
- [NV Energy 2026 IRP DC demand (mynews4)](https://mynews4.com/news/local/nv-energys-new-long-term-plan-highlights-massive-power-demand-tied-to-data-centers)
- [Amazon 700 MW carbon-free deal with NV Energy](https://www.esgtoday.com/amazon-invests-in-700-mw-of-new-carbon-energy-projects-to-power-future-data-centers-in-nevada/)
- [Entergy + Meta $2B savings agreement (Entergy)](https://www.entergy.com/news/entergy-louisiana-announces-a-new-agreement-with-meta-that-will-deliver-an-additional-2b-in-customer-savings)
- [Meta-Entergy adds $12B; $57B 4-yr capex plan (Utility Dive)](https://www.utilitydive.com/news/new-generation-adds-12b-entergy-capital-plan/818790/)
- [Meta Hyperion: $200B, 10 gas plants (TheNextWeb)](https://thenextweb.com/news/meta-200-billion-hyperion-data-center-louisiana)
- [Entergy spends additional $14B on Meta DCs (Energy.Media)](https://energy.media/climate_deals/entergy-spends-additional-14-billion-on-powering-meta-data-centers/)
- [Entergy in a new era of DC load growth (FactSet)](https://insight.factset.com/entergy-in-a-new-era-of-data-center-driven-load-growth)
- [NextEra Q1 2026 8-K](https://www.sec.gov/Archives/edgar/data/0000753308/000075330826000028/neeq12026exhibit99.htm)
- [NextEra: utility built for DC power crunch (Seeking Alpha)](https://seekingalpha.com/article/4901162-nextera-energy-the-utility-built-for-the-data-center-power-crunch)
- [Why NEE bets on gas, nuclear, DC (Insider Monkey)](https://www.insidermonkey.com/blog/why-nextera-energy-nee-is-betting-on-gas-nuclear-and-data-center-demand-1754300/)
- [2026 Q1 utilities divided on DCs (Utility Dive)](https://www.utilitydive.com/news/2026-q1-earnings-utilities-data-centers-affordability/820079/)
- [PJM Auction procures 134,479 MW (PJM)](https://insidelines.pjm.com/pjm-auction-procures-134479-mw-of-generation-resources/)
- [Data centers 40% of PJM capacity costs (Utility Dive)](https://www.utilitydive.com/news/data-centers-pjm-capacity-auction/808951/)
- [PJM capacity record-high; shortfall vs reliability (Utility Dive)](https://www.utilitydive.com/news/pjm-interconnection-capacity-auction-data-center/808264/)
- [FERC alarm over PJM reliability shortfall (Utility Dive)](https://www.utilitydive.com/news/ferc-pjm-reliability-data-center-large-load/808352/)
- [E3 Large Load Tariff Whitepaper (May 2026)](https://www.ethree.com/wp-content/uploads/2026/05/E3_Large-Load-Tariff-Whitepaper-1.pdf)
- [RMI: what PJM states can do on DC boom](https://rmi.org/unpacking-the-pjm-cifp-decision-what-pjm-states-can-do-to-ensure-affordable-reliable-electricity-during-the-data-center-boom/)
- [PA PUC large load tariff framework (Apr 30, 2026)](https://www.puc.pa.gov/press-release/2026/puc-acts-to-protect-ratepayers-guide-data-center-growth-with-new-large-load-tariff-framework-4-30-26)
- [DOE large load interconnection proposal sparks jurisdiction concerns](https://www.utilitydive.com/news/doe-large-load-interconnection-ferc-naruc/806278/)

## _new_nodes_suggested

- **U2 — Public power & federal entities (TVA, BPA, NYPA, MEAG, LADWP)**: tax-exempt debt, federal preference power, different cost-of-capital and political constraints vs. IOUs.
- **U3 — Transmission-only specialists (ITC, Oncor, AEP Transmission, LS Power)**: pure-play T&D rate base, FERC-regulated transmission incentives, MISO/PJM/SPP Order 1920 long-range planning.
- **R1 — Large-load tariffs & rate-design battleground**: Oregon DC rate class, VA SB 253, PA PUC Apr 2026 framework, Xcel MN incremental cost test, ~60 state filings tracked by SEPA. Where cost-shift fights land.
- **R2 — ISO/RTO interconnection reform**: PJM CIFP, ERCOT SB6, MISO LRTP, FERC Order 2023 backlog. Directly throttles utility capex execution.
- **F1 — Hyperscaler private-credit SPV financing (Beignet, Blue Owl, BlackRock)**: off-balance-sheet DC + generation funding that bypasses utility rate base.
- **M1 — Utility M&A (NEE-Dominion, PGE-PacifiCorp WA)**: scale consolidation driven by DC capex needs.
- **N1 — SMR off-take by regulated utilities (TVA-Kairos, Dominion-X-energy, Entergy-nuclear MOU)**: where merchant SMR ambition meets regulated rate-base reality.

---

## China domestic AI stack

## Current state (May 2026)

China now operates a largely self-contained AI compute stack — silicon, memory, system integration, foundation models, and hyperscalers — running in parallel to the Western build-out and increasingly insulated from BIS export controls.

**Compute silicon — Huawei Ascend is the anchor.**
- Ascend 910C: ~60-70% of an H100 on single-chip inference (~780 BF16 TFLOPS vs ~2,000 for H100), but ~$15-28k per card vs ~$25-30k. ~600,000 units targeted for 2026 output, up roughly 2x YoY.
- Ascend 910D: 5nm-class, 4-die package, FP8 support, mass production Q2-Q3 2026, ~$15k street price. Closes the gap on Blackwell at the chip level but still trails Rubin.
- Ascend 950PR (Q1/Q2 2026) and 950DT (Q4 2026): pair Huawei's own HBM (HiBL 1.0 at 1.6 TB/s, HiZQ 2.0 at 4 TB/s) with the new NPU; 750k units of 950PR planned for 2026.
- CloudMatrix 384 supernode: 384 910C chips in an all-optical mesh delivers 300 PFLOPS BF16 (~2x GB200 NVL72), 49.2 TB HBM (~3.6x), 1,229 TB/s bandwidth (~2x). MSRP ~$8M, ~559 kW per rack (~4x GB200), already shipping to Huawei's Wuhu DCs, Chinese cloud providers and enterprise.
- Atlas 950 SuperPoD (8,192 chips) ships Q4 2026; Atlas 960 SuperPoD (15,488 chips) targets Q4 2027.
- Cambricon: only other firm (with Huawei) on the government AI procurement list. Q1 2026 revenue $423M (+160% YoY), net income $140M (+185%). FY2026 consensus ~RMB 23B (~$3.2B, +174%). Market cap ~$130B; stock briefly topped Kweichow Moutai by price. Target 500k accelerators in 2026, up from ~116k. ByteDance pre-ordered ~200k Siyuan 590; Alibaba ramping.
- Sanctioned GPU startups Biren and Moore Threads remain on Entity List, but are filing for STAR Market IPOs. Moore Threads Q1 2026 revenue +155% to ~$103M, first profitable quarter; "Huagang" architecture aims at H100-class in 2026.

**Foundry — SMIC is the bottleneck that is finally bending.**
- 7nm DUV multipatterning yields have climbed to 60-70% from <40% at launch in late 2023.
- 7nm capacity ~20k wspm with Huawei taking ~15k; SMIC is doubling 7nm capacity in 2026. Total advanced-node (≤7nm) capacity ~45k wspm end-2025, ramping to ~60k 2026 / ~80k 2027 per SemiAnalysis.
- 5nm in pilot production at ~30% yield, ~50% cost premium vs TSMC; mass production targeted 2026 for Huawei + Alibaba next-gen AI silicon. TechInsights still confirms Huawei consumer SoCs ship on N+2 (7nm), so 5nm-at-scale remains the swing factor.
- Two new Huawei-dedicated fabs come online in 2026; China is targeting a 5x output increase across 7nm+5nm by 2028, funded by the $47.5B Big Fund III.

**Memory — CXMT and YMTC are the two critical pillars.**
- CXMT: DDR5-8000 and LPDDR5X-10667 in volume on 16nm (D1z); ~4-5% of global DRAM share (now #4). Targeting 300k wspm in 2026 with ~60k allocated to HBM3. HBM3 sampling to Huawei since H2 2025; mass production targeted end-2026 but yields ~50% and thermal issues are pushing real volume toward 2027-2028. Best estimate: ~7M HBM3 dies in 2026, sufficient for ~600k H100-class accelerators (matching Huawei's 910C target). Planned IPO of up to $4.2B on STAR Market to fund HBM3 ramp. Not on full Entity List (Japanese lobbying).
- YMTC: Targeting 15% of global NAND by end-2026 (~150k wspm); shipping 232-layer TLC via 2-deck bonding (294 layers effective), Xtacking 4.0/Gen5 in production. Building a fab line using only domestic equipment (AMEC, Naura, Piotech). Notable inversion: Samsung is licensing YMTC's hybrid bonding for its 400-layer NAND.

**Foundation models — DeepSeek as the cost-disruption lever.**
- DeepSeek V3 trained for ~$5.6M; R1 matched OpenAI-o1 on reasoning at a small fraction of training cost. Open-sourced inference stack shows a theoretical 545% gross margin at R1 list pricing.
- DeepSeek V4 (April 2026 preview): V4-Pro at 1.6T params, 1M-token context, GPT-5.2-class on hard benchmarks; V4-Flash for ultra-cheap inference. Tightly integrated with Huawei Ascend.
- $20B+ round in progress with Tencent and Alibaba as anchor investors (~$300M minimum) — first outside capital after years of running solely on High-Flyer Capital.
- Other labs at frontier scale: Alibaba Qwen3.5 (Apache-style license, 60% cheaper than Qwen2.5); Baidu ERNIE 5.0 (2.4T param omnimodal, trained on Kunlun); ByteDance Doubao/Seed 2.0 (155M weekly active users, GPT-5.2-class Pro, $0.10-0.25/M tokens Lite/Mini); Moonshot Kimi K2.6 (1T params, beats GPT-5.4-xhigh on SWE-Bench Pro); MiniMax M2.7; Zhipu GLM-5 (MIT license, trained end-to-end on Ascend, uses DeepSeek sparse attention). Chinese share of OpenRouter token volume now >45%, up from <2% a year ago.

**Hyperscalers and DC capex.**
- Alibaba: RMB 380B (~$53B) committed across 3 years for AI/cloud; new larger plan flagged. Alibaba T-Head Zhenwu 810E in deployment alongside Ascend.
- ByteDance: ~RMB 160B (~$23B) 2026 capex, ~$13B on AI processors.
- Tencent: 2026 AI product spend ~2x 2025's RMB 18B; 2025 total capex RMB 79.2B, lifted by mixed buy+lease compute strategy.
- Baidu: AI Cloud GPU revenue +184% YoY in Q1 2026; Kunlunxin spin-off and listing progressing.
- Goldman Sachs: Chinese AI providers ~$70B in DC capex in 2026; full China AI investment ~$125B in 2025, on track higher in 2026. Share of capex going to domestic chips rising from the historical 25-50% baseline.
- China Mobile recently issued a $2.65B AI server tender requiring Huawei silicon exclusively; multiple cities have set 70% AI chip self-sufficiency targets; PRC has ordered telco operators to displace AMD/Intel CPUs by 2027.
- "Eastern Data Western Compute" megaproject (launched 2022): 8 national hubs + 10 clusters routing training-style workloads to renewable-rich western provinces (Inner Mongolia, Guizhou, Gansu, Ningxia) while latency-sensitive workloads stay east; Zhangjiakou is the breakout cluster.

## Strategic position

- BIS export controls have stopped being a brake and started being a forcing function. The April 2025 H20 ban cost NVDA $4.5B in Q1 FY26 inventory charges, $2.5B unshipped, and an ~$8B Q2 guide-down. CFO Kress has publicly written off the ~$50B China AI accelerator market and warned competitors will fill it.
- The stack is now end-to-end domestically buildable for the first time: SMIC 7nm (heading to 5nm) + CXMT HBM3 + Huawei Ascend 950 + CloudMatrix supernode + Ascend-trained models (GLM-5, DeepSeek V4). Software side, MindSpore + DeepSeek-style efficient training reduce the CUDA moat.
- Chinese frontier models are now 15-30x cheaper per token than US frontier peers for comparable workloads, which both backfills domestic demand and starts exporting price pressure outward via OpenRouter and Alibaba/Tencent international clouds.
- Power economics flip a key advantage to China: CloudMatrix uses ~4x the power of GB200 per PFLOP, but Chinese industrial power costs are roughly 1/4 of US datacenter power, so total cost of compute is competitive.
- The graph would systematically undercount global AI demand without Z1: ~$70B+ of dedicated DC capex, ~600k+ domestically built H100-class accelerators in 2026, and a parallel foundation-model market with its own consumer/enterprise footprint not visible from US-listed names.

## Risks

- HBM remains the binding constraint. CXMT HBM3 thermal/yield problems could cap 2026 Ascend output below the 600k target; real HBM3E volume probably slips to 2028+.
- SMIC 5nm yield is ~30% with no EUV path; if 5nm at-scale slips, Huawei Ascend 960 (2027) gets pushed and the gap to NVDA Rubin widens.
- Power and grid: 559 kW per CloudMatrix rack and the broader domestic ramp stress provincial grids despite EDWC's renewables; cooling/water in Western hubs is a soft cap.
- Concentration risk: Cambricon's top customer is ~80% of revenue (ByteDance), and government procurement preference for Huawei+Cambricon squeezes Biren/Moore Threads/MetaX even if they execute.
- Sanction escalation: BIS could tighten DUV equipment service contracts (ASML), TSMC leakage paths via shell foundries could be closed (TSMC currently produces some Ascend wafers via poor screening), and HBM transshipment via Korea could be blocked — any of which delays the roadmap 12-24 months.
- Software lock-in: CUDA replacement (MindSpore, Triton-Ascend, CANN) still trails on operator coverage; sustained closed-model exports may require either CUDA emulation or a frontier model differentiated enough to drag developers off NVDA.
- Demand risk: Chinese AI capex is heavily state-directed; a domestic real-estate or fiscal shock could cut hyperscaler capex faster than US peers.

## Cross-cutting

- **S3 (geopolitics):** Z1 is the direct counterweight to US export controls. Each tightening (Oct 2022, Oct 2023, Dec 2024, Apr 2025 H20) has accelerated Z1's vertical integration. If a Taiwan contingency materializes, Z1 becomes the only operating AI stack inside Greater China.
- **NVDA China revenue:** Z1's progress maps inversely onto NVDA's China data center line. Pre-sanctions NVDA had ~95% Chinese AI share; now <60% and trending lower. CFO has guided to losing the ~$50B addressable market entirely if export controls persist; Z1 is the mechanism by which that loss becomes permanent rather than recoverable on policy reversal.
- **DeepSeek competitive pressure on Western models:** DeepSeek V3/R1/V4 have already triggered an ~$1T US tech selloff at peak. V4-Flash at $0.10-0.25/M tokens forces OpenAI, Anthropic, Google to compress inference margins or differentiate at the frontier. This affects unit economics for every Western model lab and indirectly compresses NVDA hyperscaler demand if cheap-China models cannibalize US API usage.
- **Memory cycle:** CXMT HBM3 + YMTC NAND ramp add a third pole to a previously SK Hynix / Samsung / Micron oligopoly, with eventual price implications for Western HBM if Chinese supply spills into commodity DDR/NAND and frees Korean/US capacity for HBM.
- **Power:** Z1 hyperscaler capex feeds Chinese coal, hydro, and increasingly nuclear demand; EDWC explicitly co-locates compute with renewables in the west — a cleaner counterpart to the gas-heavy US AI buildout.

## Sources

- [DeepSeek research suggests Huawei's Ascend 910C delivers 60% of Nvidia H100 inference performance — Tom's Hardware](https://www.tomshardware.com/tech-industry/artificial-intelligence/deepseek-research-suggests-huaweis-ascend-910c-delivers-60-percent-nvidia-h100-inference-performance)
- [Huawei Ascend AI 910D processor designed to take on Nvidia's Blackwell and Rubin GPUs — Tom's Hardware](https://www.tomshardware.com/tech-industry/artificial-intelligence/huawei-ascend-ai-910d-processor-designed-to-take-on-nvidias-blackwell-and-rubin-gpus)
- [Huawei AI CloudMatrix 384 — China's Answer to Nvidia GB200 NVL72 — SemiAnalysis](https://newsletter.semianalysis.com/p/huawei-ai-cloudmatrix-384-chinas-answer-to-nvidia-gb200-nvl72)
- [Huawei's CloudMatrix AI Supercomputer — TechInsights](https://www.techinsights.com/blog/huaweis-cloudmatrix-ai-supercomputer-new-force-ai-compute)
- [Huawei reveals 3-year Ascend AI chip roadmap, 950 coming in 2026 — Huawei Central](https://www.huaweicentral.com/huawei-reveals-3-year-ascend-ai-chip-roadmap-950-coming-in-2026/)
- [Huawei Plans Massive Production Boost: 600,000 Ascend 910C chips — MLQ](https://mlq.ai/news/huawei-plans-massive-production-boost-600000-ascend-910c-ai-chips-to-challenge-nvidia/)
- [Huawei Ascend Production Ramp: Die Banks, TSMC Continued Production, HBM is The Bottleneck — SemiAnalysis](https://newsletter.semianalysis.com/p/huawei-ascend-production-ramp)
- [SMIC 1H25 Net Profit Rises 35.6%, 7nm Capacity Reportedly to Double in 2026 — TrendForce](https://www.trendforce.com/news/2025/08/29/news-smic-1h25-net-profit-rises-35-6-7nm-capacity-reportedly-to-double-in-2026/)
- [China Reportedly Aims to Boost 7nm, 5nm Output Fivefold in Two Years — TrendForce](https://www.trendforce.com/news/2026/02/25/news-china-reportedly-aims-to-boost-7nm-5nm-output-fivefold-in-two-years-driven-by-smic-and-hua-hong/)
- [Huawei sticks to 7nm for latest processor as China's chip advancements stall — Tom's Hardware](https://www.tomshardware.com/tech-industry/huawei-sticks-to-7nm-for-latest-processor-as-chinas-chip-advancements-stall)
- [CXMT unveils DDR5-8000 and LPDDR5X-10667 — Tom's Hardware](https://www.tomshardware.com/pc-components/dram/chinas-banned-memory-maker-cxmt-unveils-surprising-new-chipmaking-capabilities-despite-crushing-us-export-restrictions-ddr5-8000-and-lpddr5x-10667-displayed)
- [China Semiconductors: CXMT Capacity Plateaued Under U.S. Curbs — The Economy](https://economy.ac/news/2026/02/202602288024)
- [China Struggles with HBM3 Mass Production — The Economy](https://economy.ac/news/2026/04/202604288912)
- [High-Bandwidth Memory: The Critical Gaps in US Export Controls — AI Frontiers](https://ai-frontiers.org/articles/high-bandwidth-memory-critical-gaps-us-export-controls)
- [YMTC aims to capture 15% of NAND market by late 2026 — Tom's Hardware](https://www.tomshardware.com/pc-components/ssds/chinas-ymtc-moves-to-break-free-of-u-s-sanctions-by-building-production-line-with-homegrown-tools-aims-to-capture-15-percent-of-nand-market-by-late-2026)
- [Top Chinese memory chip maker YMTC makes another design breakthrough — SCMP](https://www.scmp.com/tech/tech-trends/article/3296452/top-chinese-memory-chip-maker-ymtc-makes-another-design-breakthrough-defying-us-sanctions)
- [Cambricon's Q1 revenue hits $423 million — Tom's Hardware](https://www.tomshardware.com/tech-industry/cambricons-q1-revenue-hits-423-million-as-chinas-domestic-ai-chip-market-accelerates)
- [China's Push for AI Chips Drives Cambricon's Revenue and Net Income Higher — Bloomberg](https://www.bloomberg.com/news/articles/2026-04-29/cambricon-s-revenue-jumps-on-strong-ai-chip-demand-in-china)
- [AI chip designer Cambricon vaults to China's costliest stock — SCMP](https://www.scmp.com/tech/article/3351894/revenue-jumps-chinas-cambricon-metax-amid-thirst-domestic-ai-chips)
- [US sanctions on Biren and Moore Threads — SCMP](https://www.scmp.com/tech/tech-war/article/3238400/tech-war-us-sanctions-biren-and-moore-threads-strike-strong-blow-chinas-gpu-champions)
- [Blacklisted Chinese GPU makers line up to file for IPOs — Tom's Hardware](https://www.tomshardware.com/pc-components/gpus/blacklisted-chinese-gpu-makers-line-up-to-file-for-ipos-as-us-sanctions-and-trade-war-take-toll-on-ai-hardware-market)
- [DeepSeek shows power of V3, R1 models with theoretical 545% profit margin — SCMP](https://www.scmp.com/tech/big-tech/article/3300734/deepseek-shows-power-v3-r1-models-theoretical-545-profit-margin)
- [DeepSeek V4 with rock-bottom prices and close integration with Huawei's chips — Fortune](https://fortune.com/2026/04/24/deepseek-v4-ai-model-price-performance-china-open-source/)
- [Tencent, Alibaba in talks to invest in DeepSeek at $20B+ valuation — Tech Startups](https://techstartups.com/2026/04/22/tencent-alibaba-in-talks-to-invest-in-deepseek-at-20-billion-plus-valuation/)
- [Chinese AI Models Q2 2026: 10-Provider Landscape Report — Digital Applied](https://www.digitalapplied.com/blog/chinese-ai-models-q2-2026-market-share-report)
- [Best Chinese AI Models 2026: Kimi K2.6, DeepSeek V3.2, Qwen, GLM Compared — TokenMix](https://tokenmix.ai/blog/best-chinese-ai-models-2026-comparison-guide)
- [Alibaba considers increasing AI data center capex spend to $69bn — DCD](https://www.datacenterdynamics.com/en/news/alibaba-considers-increasing-ai-data-center-capex-spend-to-69bn-over-three-years-report/)
- [Alibaba, Tencent, Baidu Q4 earnings reveal what AI ambition costs — CIW](https://www.ciw.news/p/alibaba-tencent-baidu-q4-2025)
- [North American AI Data Center Expansion Drives 2026 CapEx of Top Nine CSPs to US$830B — TrendForce](https://www.trendforce.com/presscenter/news/20260506-13033.html)
- [China's AI providers expected to invest $70B in data centers — Goldman Sachs](https://www.goldmansachs.com/insights/articles/chinas-ai-providers-expected-to-invest-70-billion-dollars-in-data-centers-amid-overseas-expansion)
- [How is China's Eastern Data Western Compute developing? — Sinocities](https://sinocities.substack.com/p/how-is-chinas-eastern-data-western)
- [More Than Meets the AI: China's Data Centre Strategy — ICDS](https://icds.ee/en/more-than-meets-the-ai-chinas-data-centre-strategy/)
- [Nvidia takes $4.5bn hit due to export restrictions — Computer Weekly](https://www.computerweekly.com/news/366625005/Nvidia-takes-45bn-hit-due-export-restrictions)
- [NVIDIA Q1 FY2026 Financial Results — NVIDIA](https://nvidianews.nvidia.com/news/nvidia-announces-financial-results-for-first-quarter-fiscal-2026)
- [Nvidia logs 69% Q1 revenue jump despite Trump export controls — Manufacturing Dive](https://www.manufacturingdive.com/news/nvidia-q1-2026-earnings-export-controls-china-trump/749261/)

## _new_nodes_suggested

- **Z1a — Huawei Ascend silicon family**: Chip-level node for 910C / 910D / 950PR / 950DT / 960 / 970 roadmap, production volumes, and supernode systems (CloudMatrix 384, Atlas 950, Atlas 960). Parent of CloudMatrix demand on SMIC and CXMT.
- **Z1b — SMIC + China advanced foundry**: Capacity, yield, and node-progression node for 7nm/5nm output, Big Fund III funding, and dedicated Huawei fabs. Feeds Z1a and bottlenecks the entire stack.
- **Z1c — CXMT + China HBM ramp**: Memory-supply node tracking HBM3 / HBM3E timing, yield, thermal issues, and the $4.2B STAR IPO. Direct dependency for Z1a; cross-link to global HBM oligopoly.
- **Z1d — DeepSeek + efficient-inference disruption**: Tracks V3 / R1 / V4 release cadence, training cost, inference margin, and the Tencent/Alibaba $20B+ funding round. Links to Western frontier-lab unit economics.
- **Z1e — China hyperscaler capex**: Alibaba / Tencent / Baidu / ByteDance / China Mobile DC capex node ($70B 2026 estimate) with Eastern Data Western Compute as a sub-node.
- **Z1f — Chinese AI ASIC alternates**: Cambricon (gov-blessed), Biren, Moore Threads, MetaX, Alibaba T-Head, Baidu Kunlun. Tracks the non-Huawei domestic accelerator share and IPO pipeline.
- **Z1g — China consumer + enterprise AI demand**: Doubao (155M WAU), Qwen, ERNIE, Kimi, GLM, MiniMax — the application-layer pull-through that justifies the silicon and DC ramp.

---

## Quantum + silicon photonic compute

## Current state (May 2026)

Two adjacent "beyond-silicon" paradigms with very different maturity curves. Photonics is shipping revenue and getting strategically acquired; quantum is still a narrative with a small but real revenue tail.

### Silicon photonics / optical compute (the real one, near-term)

The sector just got revalidated by NVIDIA injecting $4B into Coherent + Lumentum ($2B each) one day before Ayar Labs' mega-round, and by Marvell buying Celestial AI outright. CPO (co-packaged optics) is now treated as the inevitable next interconnect for AI scale-up.

- **Ayar Labs** — Closed **$500M Series E at $3.75B valuation** on March 3, 2026 (led by Neuberger Berman; ARK, Insight, MediaTek, QIA, Sequoia Global, 1789 Capital, Alchip). Brings total raised to ~$870M. This nearly quadruples valuation from the Dec 2024 $155M Series D (AMD/Intel Capital/NVIDIA). TeraPHY optical I/O chiplet delivers 8 Tbps; first UCIe optical interconnect. Pat Gelsinger sits on board. Fab is GlobalFoundries, talking to TSMC and Intel. Commercialization mid-2026.
- **Lightmatter** — Still at the **$4.4B Series D valuation** set in Oct 2024 ($400M led by T. Rowe Price; total raised ~$850M). Headcount 330 (Apr 2026), nearly 2x late-2024. Jan 2026: signed Cadence (EDA tooling) and GUC (CPO production partner) partnerships. Passage M1000 photonic interposer claims 114 Tbps; readying for hyperscaler mass deployment.
- **Celestial AI** — **Acquired by Marvell**, deal closed Feb 2, 2026. Structure: $1B cash + ~27.2M MRVL shares (~$2.25B) + up to ~27.2M earn-out shares tied to cumulative revenue of $500M (1/3 vest) to $2B (full vest) by FY29. Total deal value ~$5.5B. Pre-acquisition, Celestial had raised ~$600M (Fidelity-led $250M in Mar 2025 plus extension; Tiger, BlackRock, AMD Ventures, Temasek). Photonic Fabric chiplet at 16 Tbps; first hyperscaler delivery 1H 2026, xPU/switch integration 2H 2026; Marvell guides material revenue late 2028, ~$1B run-rate by end of 2029.
- **Lightelligence** — **IPO'd on Hong Kong Stock Exchange April 28, 2026** (China-listed photonics inference angle now investable). PACE 2 hybrid optoelectronic accelerator and Photowave CXL-compatible interconnect at OFC 2026. Original MIT-spinout founders, Tencent and Sequoia backed.
- Cross-stack context: NVIDIA's own **Quantum-X (InfiniBand, early 2026)** and **Spectrum-X Photonics (Ethernet, 2H 2026)** CPO switches use TSMC 3D hybrid bonding, NVIDIA micro-ring modulators, claim 3.5x power efficiency and 4x fewer lasers. (Tracked separately under W2/W3 — NVIDIA is both a customer and competitor to the merchant photonics players.)

### Quantum computing (narrative-heavy, modest revenue)

Pure-play quantum stocks ran up 6,200% trailing 12-month at peak in mid-Oct 2025. The hangover started in Q1 2026.

- **IonQ (IONQ)** — Trapped ion. **Q1 2026 GAAP revenue $64.7M, +755% YoY**; FY26 guide raised to $260–270M; RPO $470M (+554% YoY). FY25 revenue was $130M — first quantum company over $100M GAAP. Cash $3.3B (Dec 2025). Shareholders approved **$1.8B acquisition of SkyWater** for domestic ion-trap chip fab. First 256-qubit system sold; new Boulder R&D lab. Trades ~$55 (May 2026), up ~16% YTD vs peers down. Deep NVIDIA CUDA-Q integration; GTC 2026 KISTI hybrid HPC MoU.
- **Rigetti (RGTI)** — Superconducting. **Q1 2026 revenue $4.4M, +199% YoY**; GAAP net income $33.1M is mostly warrant fair-value gains (non-GAAP loss $14.7M). Cash $569M, no debt. Launched 108-qubit Cepheus-1; 36-qubit delivered to US gov; Lyra 100+ qubit targeted Q4 2026; $100M India C-DAC order; up to $100M US CHIPS Act LOI with equity stake. Analyst FY26 revenue est ~$21–24M.
- **D-Wave (QBTS)** — Quantum annealing + now gate model (via Quantum Circuits acquisition, $252M cash). **Q1 2026 revenue only $2.9M** (down 81% YoY due to Q1 2025 having a $12.6M one-time system sale), but **bookings $33.4M (+1,994% YoY)** anchored by $20M FAU annealing system sale and first $10M QCaaS enterprise license. RPO $42.4M; cash $588M. Net loss $18.4M. Outlook raised to 2-3 system sales/year. Real commercial wins (Shionogi pharma 10x; PostQuant blockchain with 1,600 nodes) but revenue lumpiness exposes story.
- **IBM Quantum** — Heron r2/r3 (156 qubits, fixed-frequency + tunable couplers) is the production core of System Two. **Kookaburra (2026)** is the modular qLDPC + logical processing unit milestone (1,386 qubits per chip, 4,158 qubits in a 3-chip system). Nov 2025 update added Nighthawk (120Q for near-term advantage) and Loon (error-correction hardware). Target: quantum advantage end of 2026, fault-tolerant by 2029 (Starling, 200 logical qubits, 100M gates).
- **PsiQuantum** — Photonic quantum, private, **$7B valuation post-Sep 2025 $1B Series E** (BlackRock, Temasek, Baillie Gifford, NVentures, QIA, Counterpoint). Total raised ~$2.1B. Australia $617M (AUD $940M) deal still on; in 2026 moved Brisbane site to **Moreton Bay Central**. Omega chipset (Nature, Feb 2025) at GlobalFoundries Fab 8. Target: utility-scale machine by end of 2027 (ambitious).
- **Google Quantum AI** — Willow (105Q, Dec 2024) showed below-threshold quantum error correction — exponential error suppression at 3x3 → 5x5 → 7x7 surface codes. 2026: claimed first "verifiable quantum advantage" on a Willow benchmark. Sits at Milestone 2 of 6 on Google's roadmap to a million-qubit FT machine by ~2030.
- **Microsoft Azure Quantum / Majorana 1 (Feb 2025)** — Topological qubit using indium arsenide + aluminum to create Majorana zero modes. Nature peer-reviewers explicitly said the paper does NOT establish presence of MZMs. Late 2025 follow-up paper demonstrated X-Z parity measurements (partial validation). DARPA US2QC fault-tolerant prototype on the books. History matters: 2018 Majorana paper was retracted in 2021. Highest-risk / highest-reward bet in the field.

### Stock hangover

- Pure-play quantum stocks (IONQ, RGTI, QBTS, QUBT) collectively raised $4.15B in 2025 — pure dilution.
- Insider net selling ~$615M over trailing 12 months (Motley Fool flagged); short interest IONQ 22%, RGTI 15%, QBTS 14%, QUBT 26%.
- Rigetti forward P/S ~309x (NVDA ~12x).
- IONQ +16% YTD May 2026 (only positive pure-play). RGTI -10% YTD, QBTS -9% YTD; group moves 6-9% on no news.
- Big Tech (GOOGL, MSFT, IBM) doing the actual physics — pure-plays risk being squeezed as commoditization approaches.

## Strategic position

**Photonics is the credible near-term AI infrastructure play.** Three signals in <60 days:
1. NVIDIA $2B + $2B into Coherent + Lumentum (Mar 2026)
2. Ayar Labs $500M @ $3.75B (Mar 2026)
3. Marvell $5.5B all-in for Celestial AI (closed Feb 2026)

The AI interconnect power wall is real — copper SerDes is a binding constraint by 2027-2028 GPU generations. CPO is on every hyperscaler roadmap. Winners get strategic acquisition or sole-source designs into Blackwell-Next/Rubin-class systems. Likely M&A targets in 12 months: Lightmatter (Cadence/GUC tie-ins look like a pre-acquisition grooming), Ayar Labs (Intel or AMD natural acquirer), Lightelligence (now public, harder).

**Quantum is mostly narrative for AI training.** No credible path to quantum accelerating LLM training in this decade. The honest near-term value: (a) hybrid chemistry/materials simulation (drug discovery), (b) optimization (D-Wave's niche), (c) government/defense sovereignty plays (Rigetti CHIPS, IonQ SkyWater, PsiQuantum Australia), (d) sensing and quantum networking adjacencies. IonQ's revenue is real but a meaningful fraction is government/defense and partnership/grant-flavored, not commercial AI infrastructure.

NVDA is the bridge: CUDA-Q hybrid quantum-classical stack means NVIDIA captures value regardless of which qubit modality wins. NVIDIA is also the largest single beneficiary of photonic interconnect demand. "Q1 node" is really two stories that share investor mindshare more than physics.

## Risks

- **Photonics yield/manufacturing**: CPO is exquisitely sensitive — 3D hybrid bonding, micro-ring thermal control, laser reliability. NVIDIA's own switches keep slipping by 6+ months between announcements.
- **Photonics commoditization**: If hyperscalers (especially Broadcom and NVIDIA) absorb the IP, merchant photonics startups get squeezed into a single big-customer concentration risk (Celestial→Marvell is already this story).
- **Quantum dilution**: At current burn rates, IONQ/RGTI/QBTS will keep issuing equity. Cap tables doubling every 18-24 months.
- **Quantum "advantage" definitional drift**: Each generation of "quantum advantage" claim has been narrowed to artificial benchmarks. AI training advantage is not on any credible 5-year roadmap.
- **Microsoft Majorana scientific risk**: A second retraction would be devastating — the 2018 retraction precedent looms.
- **PsiQuantum execution**: Brisbane site already shifted; 2027 "utility-scale" target is widely viewed as aspirational.
- **Stock momentum reversal**: 50%+ drawdowns in quantum names have happened repeatedly; insider net selling continues.
- **Geopolitical**: Lightelligence's HK listing is a tell — US/China quantum/photonics decoupling is accelerating; export controls on photonics IP are plausible.

## Cross-cutting

- **W2/W3 (networking / optical)**: Ayar Labs, Lightmatter Passage, and Celestial AI Photonic Fabric are functionally the same competitive set as NVIDIA Quantum-X/Spectrum-X CPO switches and Broadcom's TH5 with CPO. The merchant-vs-platform tension is the central story.
- **NVDA**: Triple exposure — (1) buying $4B of Coherent + Lumentum for laser/photonic supply, (2) shipping its own CPO switches, (3) CUDA-Q as quantum-classical bridge layer. Treat NVDA as the dominant beneficiary node regardless of which sub-paradigm wins.
- **AMD, Intel**: Both AMD Ventures and Intel Capital are in Ayar Labs; Pat Gelsinger now on Ayar board. Optical I/O on next-gen MI400/Falcon Shores class accelerators is the obvious 2027 product.
- **Marvell (MRVL)**: Now an optical-compute platform stock via Celestial — directly comparable to Broadcom AVGO custom-silicon thesis.
- **TSMC**: 3D hybrid bonding for CPO is a TSMC-gated technology. CPO ramp = TSMC packaging revenue line item.
- **GlobalFoundries**: Ayar Labs and PsiQuantum both fab at GF — GF is the under-discussed photonics foundry beneficiary.
- **Power (energy node)**: Photonics is sold on power-per-bit, not just throughput. The case is "if scale-up stays on copper, AI factories hit a wall before grid." Photonics extends the runway for the data-center power story rather than relieving it.
- **Sovereignty plays**: SkyWater (IonQ), CHIPS Act (Rigetti), Australia (PsiQuantum) — quantum is increasingly an industrial-policy node, not a pure tech node.
- **W4 advanced packaging**: CPO competes for TSMC CoWoS/SoIC slots with HBM stacks; capacity allocation between memory packaging and photonic packaging will become a 2027 battleground.

## Sources

- [Ayar Labs Raises $500M to Mass-Produce CPO Chiplets (The Register, Mar 2026)](https://www.theregister.com/2026/03/03/ayar_labs_500m/)
- [Ayar Labs Gets $500M To Ramp Photonics Into 2028 AI Systems (NextPlatform)](https://www.nextplatform.com/connect/2026/03/04/ayar-labs-gets-500-million-to-ramp-photonics-into-2028-ai-systems/4093515)
- [Optics & Photonics News: Ayar Labs Raises US$500 Million](https://www.optica-opn.org/home/industry/2026/march/ayar_labs_raises_us$500_million/)
- [Ayar Labs $155M Series D (Dec 2024)](https://ayarlabs.com/news/ayar-labs-155m-series-d-to-address-ai-infrastructure-includes-amd-intel-capital-nvidia/)
- [Lightmatter Raises $400M Series D at $4.4B Valuation (Oct 2024)](https://lightmatter.co/press-release/lightmatter-raises-400m-series-d-quadruples-valuation-to-4-4b-as-photonics-leader-for-next-gen-ai-data-centers/)
- [Lightmatter $4.4B Valuation (DCD)](https://www.datacenterdynamics.com/en/news/photonic-computing-company-lightmatter-achieves-44bn-valuation-from-400m-series-d-funding-round/)
- [Lightmatter press releases (2026 Cadence, GUC partnerships)](https://lightmatter.co/press-releases/)
- [Marvell to Acquire Celestial AI (Investor Press Release)](https://investor.marvell.com/news-events/press-releases/detail/1000/marvell-to-acquire-celestial-ai-accelerating-scale-up-connectivity-for-next-generation-data-centers)
- [Marvell Bets Big on Optical I/O with $3.25B Celestial AI Deal (Gazettabyte)](https://gazettabyte.com/marvell-bets-big-on-optical-i-o-with-3-25b-celestial-ai-deal/)
- [Celestial AI Secures $250M (Mar 2025)](https://www.celestial.ai/blog/celestial-ai-secures-250-million-funding-to-revolutionize-ai-infrastructure-with-its-photonic-fabric)
- [Lightelligence at OFC 2026](https://picmagazine.net/article/123802/Lightelligence_advances_optical_AI_compute)
- [Lightelligence Wikipedia (HK IPO Apr 2026)](https://en.wikipedia.org/wiki/Lightelligence)
- [NVIDIA Spectrum-X & Quantum-X Photonics Switches Announcement](https://nvidianews.nvidia.com/news/nvidia-spectrum-x-co-packaged-optics-networking-switches-ai-factories)
- [NVIDIA Silicon Photonics for Agentic AI](https://www.nvidia.com/en-us/networking/products/silicon-photonics/)
- [IonQ Q1 2026 10-Q (SEC)](https://www.sec.gov/Archives/edgar/data/0001824920/000119312526211876/ionq-20260331.htm)
- [IonQ Q1 2026 Earnings 8-K](https://www.sec.gov/Archives/edgar/data/0001824920/000119312526208923/ionq-ex99_1.htm)
- [IonQ Stock: Revenue Up 755% (CoinCentral)](https://coincentral.com/ionq-stock-revenue-up-755-but-shares-slide-heres-why/)
- [IonQ–KISTI–NVIDIA CUDA-Q Hybrid Quantum HPC (GTC 2026)](https://www.ionq.com/news/ionq-to-advance-hybrid-quantum-computing-with-new-chemistry-application-and)
- [Rigetti Q1 2026 Results (StockTitan)](https://www.stocktitan.net/news/RGTI/rigetti-computing-reports-first-quarter-2026-financial-0ozmjy71iqbc.html)
- [Rigetti $100M US Govt CHIPS Act (IBTimes)](https://www.ibtimes.com.au/rigetti-computing-100m-quantum-research-funding-1869323)
- [D-Wave Q1 2026 Results (BusinessWire)](https://www.businesswire.com/news/home/20260512684377/en/D-Wave-Reports-First-Quarter-2026-Results)
- [D-Wave Q1 2026 Bookings $33.4M (BigGo Finance)](https://finance.biggo.com/news/US_QBTS_2026-05-12)
- [IBM Quantum Roadmap 2026 (Technology Atlas)](https://www.ibm.com/roadmaps/quantum/2026/)
- [IBM Nighthawk & Loon Update (Nov 2025)](https://postquantum.com/industry-news/ibm-loon-nighthawk/)
- [PsiQuantum Brisbane Site Move (ACS Information Age 2026)](https://ia.acs.org.au/article/2026/psiquantum-changes-location-for--1bn-quantum-build.html)
- [PsiQuantum $1B Series E at $7B Valuation (Optics.org)](https://optics.org/news/psiquantum-closes-1bn-equity-round)
- [Google Willow Quantum Chip (BlueQubit)](https://www.bluequbit.io/blog/googles-quantum-computing-chip-willow)
- [Google Verifiable Quantum Advantage on Willow](https://blog.google/innovation-and-ai/technology/research/quantum-hardware-verifiable-advantage/)
- [Microsoft Majorana 1 Announcement (Azure Quantum Blog)](https://azure.microsoft.com/en-us/blog/quantum/2025/02/19/microsoft-unveils-majorana-1-the-worlds-first-quantum-processor-powered-by-topological-qubits/)
- [Experts Weigh in on Microsoft Topological Qubit Claim (Physics World)](https://physicsworld.com/a/experts-weigh-in-on-microsofts-topological-qubit-claim/)
- [Microsoft Majorana-1 X/Z Parity Validation Paper](https://postquantum.com/quantum-research/microsofts-majorana1-chip-data/)
- [Quantum Stocks $931M Wall Street Warning (Motley Fool, May 2026)](https://www.fool.com/investing/2026/05/28/quantum-computing-ionq-rgti-qbts-wall-st-warning/)
- [Traders Bet Against IONQ, RGTI, QBTS Short Interest (BanklessTimes)](https://www.banklesstimes.com/articles/2026/05/22/traders-bet-against-ionq-rgti-qbts-qubt-ionq-stocks-amid-quantum-computing-hype/)
- [Which Quantum Stock Dominated 2026 YTD (24/7 Wall St)](https://247wallst.com/investing/2026/05/06/which-quantum-computing-stock-has-dominated-in-2026-ionq-rigetti-or-d-wave/)
- [The Hidden Quantum Play Inside NVIDIA's AI Strategy (Motley Fool)](https://www.fool.com/investing/2026/05/06/the-hidden-quantum-computing-play-inside-nvidias-a/)

_new_nodes_suggested:
- **W4-CPO**: Co-packaged optics supply chain (Coherent, Lumentum, NVIDIA Photonics, TSMC 3D hybrid bonding capacity) as its own node — currently scattered across W2/W3 and Q1.
- **GF-Photonics**: GlobalFoundries silicon photonics fab line (Ayar Labs + PsiQuantum + others) as a manufacturing chokepoint node distinct from GF's logic business.
- **Quantum-Sovereignty**: Industrial-policy quantum node tracking SkyWater (IonQ), CHIPS Act (Rigetti), Australia (PsiQuantum), UK NQCC, EU Quantum Flagship as a single geopolitical theme separate from the technology bets.
- **CUDA-Q**: NVIDIA's hybrid quantum-classical software layer as a moat node distinct from CUDA proper — captures value across all qubit modalities.
- **Photonic-Acquirers**: Strategic-acquirer node (Marvell, Broadcom, Intel, AMD) tracking who's likely to roll up the remaining merchant photonics startups.

---

## Foundation models + enterprise AI SW

## Current state (May 2026)

**Frontier-lab revenue is real and accelerating, but concentrated.** OpenAI hit ~$24B ARR by April 2026 (40%+ enterprise, on path to parity with consumer by year-end), generating $5.7B in Q1 2026 alone. Anthropic compounded from $9B (Dec 2025) -> $14B (Feb) -> $19B (Mar) -> $30B (Apr) -> Sacra-estimated $45B (May 2026), with 1,000+ customers spending >$1M/yr and 8 of Fortune 10 as Claude customers. Claude Code alone went from GA in May 2025 to $2.5B ARR by Feb 2026. OpenAI disputes Anthropic's gross-vs-net accounting (claims ~$8B overstated), but the trajectory is undisputed.

**Hyperscaler AI-SaaS lines are at scale.** Microsoft's FY26 Q3 (Apr 2026): AI run-rate >$37B (+123% YoY), Azure +40%, M365 Copilot at 20M paid seats (up from 15M in Jan; <4.5% of 450M+ M365 base), customers with 50K+ seat deployments quadrupled (Accenture took 740K seats). Google Cloud Q1 2026 revenue $20B (+63%), with backlog nearly doubling QoQ to >$460B; Workspace+Gemini spans 3B users / 13M customers; 15-25M paid Google AI subs.

**App-layer SaaS is monetizing AI surcharges.** Salesforce Agentforce reached $540M ARR by Q3 FY26 (+330% YoY) after abandoning $2/conversation for a three-model mix (per-seat $125-$550/mo, Flex Credits $0.10/action, conversation); still only ~8% of 150K customers adopted, and one Salesforce SE reported 10% seat compression at AI-deploying accounts. ServiceNow Now Assist ACV: $600M (end-2025) -> $750M (Q1 26), guided to $1.5B by year-end 2026 (raised from $1B); Pro Plus drives 30-42% renewal uplift; targeted at 30% of $30B 2030 ACV. Adobe Q1 FY26: total AI-influenced ARR >1/3 of book; Firefly subscription+credit-pack ARR +75% QoQ; new AI-first ARR >3x YoY. Palantir Q1 2026 revenue $1.63B (+85% YoY), US commercial +133%, NRR 150%, Rule-of-40 = 145%, FY26 guide $7.65B (+71%), market cap ~$330-350B.

**Data-platform AI is real, fastest-growing line.** Snowflake FY26 product revenue $4.47B (+30%), RPO $9.77B; 13,600+ accounts using AI/ML workloads (up from 9,100 last quarter); Cortex Code adoption >50% of customers since Nov 2025 launch. Databricks crossed $5.4B run-rate (+65% YoY), >$1.4B AI run-rate, $134B private valuation, 800+ customers at >$1M ARR.

**App-layer breakout names.** Cursor: $2B ARR by Feb 2026 (fastest B2B SaaS to $2B ever), in talks for ~$50B valuation, 60% enterprise (OpenAI, AB InBev), 70% of Fortune 1000. GitHub Copilot: 4.7M paid (+75% YoY) per MSFT FY26 Q2. Glean: $300M ARR (May 2026), doubled from $100M in 15 months, $7.2B valuation. Harvey: $190M ARR (Jan 2026) -> $11B valuation in Mar 2026 round, 100K+ lawyers. Perplexity: ~$450M ARR (Mar 2026, +50% in one month), target $656M by year-end; pivoted to credits/agents (Comet/'Computer'), Enterprise Pro $40/seat, Max $325/seat.

**Open-source pressure is now structural.** Llama 4, Qwen 3.5, DeepSeek V4, Mistral Large 3 closed the closed-vs-open gap to 6-9 months. Qwen captured 69% of derivative share by Feb 2026; on OpenRouter open-model token share, Meta Llama collapsed from 37.4% (Jan 2025) to ~0%, replaced by DeepSeek (31%) and Xiaomi (27%). Mistral Large 3 + Small 4 shipped Apache 2.0. Sovereign/on-prem patterns (vLLM, air-gapped Qwen/DeepSeek) unblock procurement. Self-host beats API above ~2-3M tokens/day sustained.

## Strategic position

**The $600B-question math, updated.** Sequoia's David Cahn's framework (NVDA data-center run-rate * 2 for TCO * 2 for end-user margin) implied a ~$600B annual revenue gap in mid-2024. By 2026 the numerator is far worse: hyperscaler capex is $660-725B (Microsoft $190B alone, Meta $125-145B, Amazon $200B, Google $175-185B, Oracle $50B), with 75% AI-attributed. Combined identifiable enterprise AI software revenue (frontier labs + Big-5 AI lines + AI-pure SaaS) is plausibly in the $150-200B annualized range exiting 2026 - large in absolute terms but still ~25-30% of one year's capex. Gartner: worldwide AI spend $2.5-2.6T in 2026, AI software $453B (up from $283B), but admits 'spending has primarily been driven by technology companies and hyperscalers, enterprises have yet to flex.' McKinsey June 2025: 80% of companies use GenAI, ~80% report no material earnings impact; 90% of vertical use-cases stuck in pilot.

**Is enterprise actually paying?** Yes, but the demand chain is narrower than headline 'AI revenue' suggests: 
  1. ~$11-15B of MSFT's $37B AI run-rate is Copilot/M365; the rest is Azure-OpenAI inference, which is largely OpenAI's $24B ARR re-counted on Azure's books.
  2. Anthropic's $30-45B flows ~85% via AWS/GCP, double-counted in Google Cloud's 63% growth and AWS AI numbers.
  3. The 'real' enterprise pay-for-software layer (Copilot seats, Agentforce, Now Assist, Firefly, Palantir AIP, Cursor, Glean, Harvey, Snowflake/Databricks AI) totals ~$60-90B run-rate - growing fast but ~10-13% of capex.
  4. OpenAI burns ~$17B cash in 2026 against $20-24B revenue; projects $14B operating loss 2026, breakeven ~2030; gross margin after inference ~48%. Anthropic projects first quarterly operating profit Q2 2026 ($559M on $10.9B revenue) - the cleanest profitability data point in the entire stack.

**Closed vs open margin pressure.** OpenAI/Anthropic premium pricing is being arbitraged by DeepSeek/Qwen for code, reasoning, multilingual workloads where open is at parity. This is the first real structural threat to closed-model gross margins and explains both labs' aggressive enterprise lock-in (Claude Code, ChatGPT Enterprise SSO, Anthropic's Bedrock/Vertex exclusives).

## Risks

- **Capex-revenue gap is widening, not closing.** Cahn's number went from $200B (2023) to $600B (2024) to ~$700B+ (2026). If hyperscaler capex grows ~70% YoY and enterprise SW revenue grows ~50%, the absolute gap widens even as ratios improve.
- **Seat compression risk is real and observed.** Salesforce internal data: 84% of customer-support interactions resolved AI-only, leading to 10% seat reduction at AI-deploying accounts. The same dynamic threatens every per-seat SaaS vendor whose AI feature obviates the seat.
- **Pricing-model thrash signals weak willingness-to-pay.** Salesforce went $2/conv -> Flex Credits -> per-seat in 12 months. Adobe forces monthly credit forfeit. Perplexity moved to consumption credits. Vendors can't find a price point enterprises will sign for at scale.
- **Adoption is still single-digit %.** M365 Copilot at <4.5% of M365 base. Agentforce at ~8% of Salesforce customers. ServiceNow Pro Plus is the fastest attach but still a minority of renewals. The 'inflection year' framing keeps getting pushed.
- **Open-source compresses closed margins.** OpenAI spends ~$125B/yr training by 2030 per projections; Anthropic ~$30B. Both face a free-rider problem against MIT/Apache Chinese labs whose strategic incentive is to give away frontier capability.
- **OpenAI unit economics.** ~$2 cost per $1 inference revenue (pre-R&D/S&M) per leaked MSFT rev-share. Negative 122% operating margin Q1 2026. $7B Q1 loss. Internal docs project $74B operating loss in 2028.
- **TSMC/ASML brake.** Per Cahn's 2026 'Tale of Two AIs,' TSMC ramped revenue 50% since 2022 but capex only 10%; the supply-side bottleneck may strand hyperscaler capex commitments as outdated before they monetize.
- **Trough of disillusionment risk (Gartner).** 'AI will most often be sold to enterprises by their incumbent software provider rather than bought as part of a new moonshot project' = AI revenue may be GenAI surcharges riding existing renewals, not net-new spend; price-elastic and reversible.
- **Accounting opacity.** Anthropic-vs-OpenAI gross-vs-net dispute; MSFT 'AI revenue' includes Azure-OpenAI which double-counts OpenAI ARR; Google Cloud growth attributed to Gemini also serves Anthropic. The headline 'AI ARR' totals likely double- or triple-count.

## Cross-cutting

- **Capex-to-revenue sanity check (links to capex/power nodes):** $660-725B Big-5 2026 capex vs. ~$150-200B identifiable AI software revenue (much of which is double-counted between labs and clouds). Real enterprise pay-for-software layer is ~$60-90B run-rate. Gap is ~5-10x. Sequoia's $600B question answer in 2026: revenue grew fast (probably 3-4x since 2024) but capex grew faster.
- **Demand-chain validation (links to AI labs, hyperscalers, NVDA):** Revenue chain is enterprise SaaS -> AI labs -> hyperscaler compute -> NVDA/TSMC. Bottleneck is at step 1 (enterprise willingness-to-pay) which is growing but not at hyperscaler capex velocity. AI lab ARR is increasingly the primary demand signal carrying the entire chain.
- **Open-source vs closed margin (links to AI labs, sovereign compute):** DeepSeek/Qwen/Llama 4 quality parity means closed-model API providers face structural margin compression; sovereign-cloud deployments of Chinese open models are the procurement-unblocking pattern.
- **Seat compression feedback loop (links to labor/jobs node):** If AI obviates seats faster than it sells new ones (per Salesforce internal data, customer-service is canary), per-seat SaaS revenue could contract even as AI features deepen - net-negative for the demand sanity check.
- **Power/grid (links to power node):** Capex translates to ~75-90 GW new hyperscaler load by 2027 - bookings backlog at Google ($460B) and Microsoft (capacity-constrained through 2026) suggest demand pull-forward, but if enterprise revenue doesn't catch up by 2027-2028, stranded capacity becomes a real risk.

## _new_nodes_suggested

- **A1a: Seat compression / labor-substitution feedback** - dedicated node tracking whether AI deployment net-adds or net-subtracts SaaS seats (Salesforce SE 10% data point, Klarna/Klarmann case studies, BPO contraction).
- **A1b: Open-source model commoditization** - Llama/Qwen/DeepSeek/Mistral as separate node tracking margin compression on closed labs and sovereign deployment patterns.
- **A1c: AI accounting & double-counting** - track gross-vs-net revenue disputes (Anthropic/OpenAI), Azure-OpenAI re-recognition, and how 'AI ARR' is constructed across the stack to avoid graph-level double counting.
- **A1d: Enterprise GenAI ROI realization** - McKinsey/Gartner 'trough of disillusionment' tracker; vertical-use-case pilot-to-production conversion.
- **A1e: AI lab unit economics** - dedicated node for OpenAI burn / Anthropic profitability / training cost gap as a leading indicator of capex sustainability.

## Sources
- [Microsoft FY26 Q3 results: 20M Copilot seats, $37B AI ARR](https://licenseq.com/microsoft-fy26-q3-results-explained/)
- [Microsoft Q3 2026 Earnings (Windows News)](https://windowsnews.ai/article/microsoft-q3-2026-earnings-azure-growth-copilot-seats-and-the-capex-ai-debate.417537)
- [Microsoft Cloud Revenues Reach $54.5B in FY26 Q3](https://office365itpros.com/2026/04/30/microsoft-cloud-fy26-q3/)
- [Alphabet Q1 2026 8-K (Google Cloud +63% to $20B, $460B backlog)](https://www.sec.gov/Archives/edgar/data/0001652044/000165204426000043/googexhibit991q12026.htm)
- [Google Cloud Next 2026 wrap-up](https://cloud.google.com/blog/topics/google-cloud-next/google-cloud-next-2026-wrap-up)
- [Gemini hits 750M users, 3.1 Pro launch](https://tech-insider.org/google-gemini-750-million-users-march-2026-updates/)
- [Salesforce Agentforce $540M ARR, multi-model pricing (SaaStr)](https://www.saastr.com/salesforce-now-has-3-pricing-models-for-agentforce-and-maybe-right-now-thats-the-way-to-do-it/)
- [Doomed Evolution of Agentforce Pricing (Monetizely)](https://www.getmonetizely.com/blogs/the-doomed-evolution-of-salesforces-agentforce-pricing)
- [ServiceNow Q1 2026 / Now Assist $750M ACV, $1.5B target](https://io-fund.com/ai-stocks/servicenow-q2-ai-push-1b-acv-target-2026)
- [ServiceNow projects $30B by 2030 / 30% AI ACV](https://thenextweb.com/news/servicenow-30-billion-2030-now-assist-ai-revenue)
- [Adobe Q1 FY26: Firefly ARR +75% QoQ, AI-influenced ARR >1/3](https://www.adobe.com/cc-shared/assets/investor-relations/pdfs/21306202/c545hjdryueyw34.pdf)
- [Adobe Firefly revenue model (Miracuves)](https://miracuves.com/blog/adobe-firefly-revenue-model/)
- [Palantir Q1 2026 8-K: $1.63B revenue +85% YoY](https://www.sec.gov/Archives/edgar/data/0001321655/000132165526000026/a2026q1ex991pressrelease.htm)
- [Palantir 10-Q Q1 2026](https://www.sec.gov/Archives/edgar/data/0001321655/000132165526000028/pltr-20260331.htm)
- [Palantir Q1 2026 deep dive (TradeThePool)](https://tradethepool.com/fundamental/palantir-earnings-reports/)
- [Snowflake FY26 Q4 results (Futurum)](https://futurumgroup.com/insights/snowflake-q4-fy-2026-results-highlight-ai-led-consumption-and-platform-expansion/)
- [Snowflake Cortex Code / Intelligence expansion](https://www.snowflake.com/en/news/press-releases/snowflake-expands-snowflake-intelligence-and-cortex-code-to-power-the-control-plane-for-the-agentic-enterprise/)
- [Databricks $5.4B run-rate, $134B valuation](https://www.techi.com/snow-vs-databricks-ai-data-war/)
- [Cursor at $2B ARR, $50B valuation talks](https://thenextweb.com/news/cursor-anysphere-2-billion-funding-50-billion-valuation-ai-coding)
- [GitHub Copilot 4.7M paid (Panto)](https://www.getpanto.ai/blog/github-copilot-statistics)
- [Glean hits $300M ARR (May 2026)](https://finance.yahoo.com/sectors/technology/articles/glean-surpasses-300m-arr-unrivaled-191000948.html)
- [Glean $200M ARR milestone](https://www.glean.com/press/glean-surpasses-200m-in-arr-for-enterprise-ai-doubling-revenue-in-nine-months)
- [Harvey AI $190M ARR, $11B valuation](https://www.cnbc.com/2026/03/25/legal-ai-startup-harvey-raises-200-million-at-11-billion-valuation.html)
- [Perplexity ARR past $450M (March 2026)](https://techstartups.com/2026/04/08/perplexity-revenue-surges-50-as-ai-startup-shifts-from-search-to-autonomous-ai-agents/)
- [Perplexity Enterprise pricing 2026](https://www.perplexity.ai/enterprise/pricing)
- [Anthropic $30B ARR passes OpenAI (April 2026)](https://www.the-ai-corner.com/p/anthropic-30b-arr-passed-openai-revenue-2026)
- [Anthropic estimated $45B ARR (Sacra)](https://opentools.ai/news/anthropic-revenue-surpasses-openai)
- [Anthropic Q2 2026 first operating profit projection](https://www.saastr.com/anthropic-just-passed-openai-in-revenue-while-spending-4x-less-to-train-their-models/)
- [Open-source LLM landscape May 2026: Llama 4, Qwen 3, DeepSeek V4, Mistral Large 3](https://www.web3aiblog.com/blog/best-open-source-llms-llama-4-qwen-3-deepseek-v3-mistral-large-3-may-2026)
- [Open-weight models H1 2026 retrospective](https://www.digitalapplied.com/blog/open-weight-models-h1-2026-retrospective-deepseek-qwen-llama)
- [Sequoia: AI's $600B question (Cahn, 2024)](https://sequoiacap.com/article/ais-600b-question/)
- [Sequoia: AI in 2026 - A Tale of Two AIs (Cahn)](https://sequoiacap.com/article/ai-in-2026-the-tale-of-two-ais/)
- [Hyperscaler capex >$600B in 2026, +36% YoY (IEEE ComSoc)](https://techblog.comsoc.org/2025/12/22/hyperscaler-capex-600-bn-in-2026-a-36-increase-over-2025-while-global-spending-on-cloud-infrastructure-services-skyrockets/)
- [Hyperscalers hit $700B 2026 AI spending (Yahoo Finance)](https://finance.yahoo.com/sectors/technology/articles/hyperscalers-hit-700-billion-2026-111243744.html)
- [Big Tech capex $725B in 2026, +77% YoY (Tom's Hardware)](https://www.tomshardware.com/tech-industry/big-tech/big-techs-ai-spending-plans-reach-725-billion)
- [AI Capex 2026: $690B sprint (Futurum)](https://futurumgroup.com/insights/ai-capex-2026-the-690b-infrastructure-sprint/)
- [Gartner: worldwide AI spending $2.5T in 2026](https://www.gartner.com/en/newsroom/press-releases/2026-1-15-gartner-says-worldwide-ai-spending-will-total-2-point-5-trillion-dollars-in-2026)
- [Gartner: enterprise software spend +15.2%, AI surcharges driving (SaaStr)](https://www.saastr.com/gartner-enterprise-software-spend-will-grow-a-stunning-15-2-next-year-but-most-of-that-will-go-to-price-increases-and-ai-apps/)
- [$700B capex / $50B revenue: AI's math is broken (Vashishta)](https://vinvashishta.substack.com/p/700-billion-in-capex-50-billion-in)

---

## Capital circle / vendor financing

## The cynical thesis

A large slice of headline "AI demand" is the same dollars circulating through 4-5 balance sheets and being booked as revenue at each stop. Vendors invest in customers; customers spend the cash back with the vendor; the vendor books revenue; both stocks re-rate; both balance sheets look stronger; the cycle accelerates. The structure rhymes with 1999 telecom vendor financing (Lucent / Nortel / Cisco lending to CLECs that bought their gear, ~$33B at peak), except the scale today is roughly 18x larger, the balance sheets are stronger, and the circular flows are more transparent — they live in S-1s, 8-Ks, and announced LOIs rather than off-balance-sheet SPVs.

Key concentrated risk: OpenAI sits in the middle of the wheel. It has committed ~$1.4T in 5-7 year infrastructure spend (later trimmed in some investor decks toward $600B by 2030) against 2025 revenue under ~$13B run-rate. HSBC modeled that OpenAI needs ~$207B of new external financing by 2030 just to deliver its existing commitments. If OpenAI growth disappoints, the wheel reverses: ORCL's $300B contract becomes unrecoverable capex, CoreWeave's $99B backlog (anchored by OpenAI + MSFT + Meta) shrinks, NVDA's $4.5T market cap re-rates, and the equity stakes NVDA holds in CoreWeave / Lambda / Crusoe / xAI / OpenAI lose value at the same moment those customers cut their NVDA orders. Circularity = correlated downside.

Jensen Huang publicly called the circularity charge "ridiculous." That is the strongest tell that it is the live debate in the room.

## NVDA strategic portfolio — the most aggressive vendor-financing playbook in tech history

NVDA has assembled an equity portfolio that systematically backs the customers buying its chips. 2025 deal count: ~67 strategic deals (vs 54 in 2024); NVentures specifically ran ~21-30 deals in 2025 vs 1 in 2022. Portfolio companies represent $40B+ in announced funding.

**Optics package — $4B, March 2026:** $2B in Coherent (COHR) + $2B in Lumentum (LITE), both non-exclusive equity + multi-billion purchase commitments tied to silicon photonics + new US fabs. LITE +12% / COHR +15% on announcement; NVDA +3%. Classic structure: NVDA puts up equity, books a purchase commitment to itself, suppliers raise prices/capacity, NVDA gets co-optimized roadmap.

**Intel — $5B, Sept 2025 (closed Dec 26, 2025):** 214.78M shares at $23.28 (private placement), ~4% stake. By the time the FTC cleared, INTC traded 36% above NVDA's strike. Coincides with NVDA-custom Intel x86 CPUs and Intel x86 SOCs with embedded NVDA RTX GPU chiplets via NVLink. SoftBank also put $2B into Intel; the US Government took $8.9B. INTC market cap ~$175B vs ~$82B low.

**CoreWeave — ~11% / $4.9B, Jan 2026:** Initial ~6.3% stake + Jan 23, 2026 follow-on of 22,935,780 shares at $87.20 = $2B. Total ~47.2M shares = ~11% of CRWV. CoreWeave represents ~20% of NVDA's equity portfolio. NVDA also has a $6.3B take-or-pay services contract with CoreWeave through 2032 — NVDA is simultaneously CoreWeave's largest equity holder, a customer, and the supplier of the assets CoreWeave borrows against. CRWV's debt = $17.3B Q1 2026 (was raising another $8.5B DDTL 4.0 in March + $3.1B DDTL 5.0 in May, both GPU + customer-contract collateralized).

**OpenAI — up to $100B LOI, Sept 22, 2025:** Non-voting shares released progressively per GW of NVDA systems deployed (10 GW target on Vera Rubin starting H2 2026). Per Feb 2026 reporting, the structure may have been simplified to a $30B equity commitment. NVDA invests → OpenAI pays NVDA for chips → NVDA books revenue → equity stake marks up. This is the most blatant single circular structure in the entire stack and is what triggered the recent wave of bubble commentary.

**Anthropic — up to $10B, Nov 2025:** NVDA's first direct check into Anthropic (alongside MSFT's $5B). Anthropic is principally a GCP/AWS customer, so NVDA's exposure is indirect.

**xAI — $2B, Oct 2025:** Of the $20B raise ($7.5B equity + $12.5B debt) for Colossus 2 in Memphis (300-550k GB200/GB300 chips). NVDA is investing into an SPV that buys NVDA hardware and leases it to xAI. Apollo + Diameter on the debt side; chips, not xAI corporate assets, secure the loan. Maximum elegance: NVDA finances its own sale.

**Neoclouds — Lambda, Crusoe, Nscale, Nebius:** NVDA in Lambda's rounds (Series E Nov 2025 $1.5B at $5.9B post; Microsoft signed a multi-billion GPU deal w/ Lambda for GB300 NVL72). NVDA in Crusoe's $600M Series D and Founders Fund-led rounds; Crusoe's Abilene campus (1.2 GW, up to 400k GB200s) is the Stargate Texas site. Nscale (Stargate Norway, 100k GPU) and Nebius ($19.4B MSFT 5-year deal for 100k GB300, 3.5+ GW) similarly backed. Pattern: NVDA capitalizes neoclouds whose entire economic purpose is to buy and rent NVDA GPUs.

**Strategic AI ecosystem:** Mistral (€1.7B round), Cohere (enterprise LLM), Wayve (Series C $1.05B + reported $500M strategic, autonomy), Recursion (drug discovery), Reflection AI, Sakana, Imbue, Perplexity, Kore.ai, Cursor (Series D $2.3B at $29.3B, Nov 2025), Synthesia ($200M, Jan 2026), Figure AI ($39B valuation), Black Forest Labs ($300M), Quantinuum ($600M), Commonwealth Fusion ($863M, Aug 2025).

**Astera Labs (ALAB):** Less direct — NVDA was a technology partner and customer rather than a documented pre-IPO equity holder (Sutter Hill 13.7% / Fidelity led the cap table). ALAB nonetheless re-rated 72% on day-1 (March 2024) as the "NVDA Blackwell pure-play."

**Rough scale of NVDA's vendor-financing exposure 2024–H1 2026:** $5B (Intel) + ~$4.9B (CoreWeave mark) + $4B (optics) + $2B (xAI) + $30-100B (OpenAI, tranched) + $10B (Anthropic LOI) + smaller checks across 100+ portfolio companies = on the order of $50-150B of NVDA capital pointed at entities whose primary use of that capital is to buy NVDA chips.

## Altman investment orbit — the picks-and-shovels portfolio that quietly benefits when OpenAI scales

Court filings in the Musk v. Altman / OpenAI suit (revealed May 2026) showed Altman personally holds >$2B in equity in companies that do business with OpenAI. He does not own equity in OpenAI itself. Every gigawatt OpenAI adds raises the value of his picks-and-shovels portfolio. Standard-recusal defense.

**Helion Energy — ~$1.7B stake (largest holding):** Altman personally put $375M into a $500M 2021 round; recruited Helion into YC in 2015; was chairman. Helion's flagship customer = Microsoft (50 MW PPA starting 2028, with financial penalties if Helion misses). MSFT is OpenAI's largest investor. Helion has never produced a kWh of grid electricity. Polaris prototype operational in Everett, WA.

**Oklo (OKLO) — ~4% stake worth ~$650M Jan 2026:** Altman was chairman until April 2025 (stepped down explicitly to clear AI-power conflicts so Oklo could sign deals w/ MSFT/Meta/Google who compete with OpenAI). Oklo IPO'd via Altman's own SPAC AltC in 2024. Stock 10x'd post-IPO; Oklo had $2.5B cash end of Q1 2026 post-$1.18B raise; no commercial revenue; Aurora-INL targeted late 2027 / early 2028. Meta signed Oklo + TerraPower + Vistra for Prometheus AI campus in Ohio (4 GW combined SMR, Jan 2026).

**Retro Biosciences — $258M stake:** Altman is the sole or lead funder. Retro has established commercial deals with OpenAI (announced in court filing). Direct conflict: OpenAI sends model usage / engineering to a company whose equity Altman owns.

**Stripe — $633M stake:** Stripe = OpenAI's payments processor. OpenAI's billing flows through Altman's portfolio company.

**Worldcoin / Tools for Humanity / WLD:** Altman is chairman; co-founded 2019. Iris-scan "proof of personhood" infrastructure for the agentic-AI era. ~33M World App users / 15M verified as of Sept 2025. Launched US May 2025. Match Group + Visa partnerships. WLD token peaked at $12 then fell ~98% to ~$0.20 before bouncing on rumors OpenAI would adopt World ID. 10% of all WLD reserved for investors. If OpenAI mandates World ID for ChatGPT agents, Altman's WLD allocation re-rates massively.

**Exowatt — initial $20M check (2024, with a16z + DiCaprio):** Modular thermal-battery solar boxes targeting data-center off-grid power. Series A $70M (April 2025) + $50M extension (Nov 2025) = $140M total. ExoRise arm sells "powered land + storage" packages to hyperscalers. Backlog of 10M P3 units = 90 GWh.

**Smaller named positions surfaced in the Musk litigation:** Cerebras ($3.2M stake — Altman led a $10B OpenAI–Cerebras compute discussion), Lattice, Humane (the failed AI Pin), Formation Bio / Trialspark, Reddit (~$600M at IPO 2024, exited end 2025 — Altman led OpenAI–Reddit content licensing in May 2024). Also previously named: Rain AI (neuromorphic chips OpenAI signed an LOI to buy from), Boom (supersonic), Cruise.

**Pattern:** OpenAI does not directly buy from most of these companies, but their equity value depends on OpenAI's continued scale + the broader AI-buildout narrative. Stargate does NOT funnel contracts to Oklo or Helion — those are MSFT and Meta deals — but the entire AI-power narrative they ride on is underwritten by Stargate's announced demand.

## Satya / MSFT positions — the original anchor LP of the AI cycle

MSFT is simultaneously OpenAI's largest investor, largest cloud supplier, largest competitor (via Microsoft AI under Suleyman), largest profit-share counterparty, largest CoreWeave customer, and the buyer underwriting almost every power/nuclear PPA in the stack. It is the closest analog to the LP whose capital recycles the most times across the graph.

**OpenAI — $13B invested 2019-2025, marked at $135B = 27% stake = 17.6x:** $11.6B deployed by Sept 2025. Restructured Oct 2025: 20% revenue share capped at $38B (saves OpenAI ~$97B through 2030 vs uncapped). OpenAI committed $250B Azure spend through 2032; MSFT IP rights extended through 2032 covering post-AGI models; right of first refusal on OpenAI's compute waived (which is what allowed the ORCL $300B + AWS $38B + AMD $90B + NVDA $100B deals to even exist).

**CoreWeave — anchor customer:** 62% of CRWV 2024 revenue, 67% of 2025 revenue. Two customers = 77% of 2024. "Mind-bendingly large deals" (Intrator). MSFT effectively underwrote the CRWV IPO; without Microsoft's GPU shortage, CRWV doesn't exist in its current form. Management guides MSFT below 50% as OpenAI + Meta + Anthropic + Meta's $21B contract ramp through 2026.

**G42 — $1.5B (April 2024) + $15.2B UAE follow-on (Nov 2025):** Brad Smith on G42 board. G42 divested from China as condition. $4.6B in DC capex, $1.2B opex 2023-25; $5.5B capex + $2.4B opex 2026-29. Microsoft secured US export license for first-ever advanced NVDA shipments to UAE (~21,500 A100-equiv already in country; an additional 60,400 A100-equiv approved Sept). Separate from Stargate UAE ($10B G42/Oracle/SoftBank/OpenAI/NVDA/Cisco). G42 also co-founded MGX with Mubadala.

**Constellation Energy / Three Mile Island:** 20-yr PPA, 835 MW, signed Sept 2024. Constellation investing $1.6B to restart + $1B DOE loan. Plant renamed Crane Clean Energy Center. Restart accelerated to 2027 from 2028. Premium price ~2x wholesale. Lifts CEG EPS growth from 10% to 13% / yr through 2030. MSFT also signed Meta-style PPAs at Clinton plant (1.1 GW). MSFT is the price-setter for nuclear restart economics.

**Helion Energy — 50 MW PPA, 2028:** First-ever commercial fusion PPA. Penalties if Helion misses. Helion has never produced electricity. Counterparty owned by OpenAI's CEO. Inside-the-perimeter conflict that Musk's attorneys repeatedly cited.

**Inflection AI — $650M license / acqui-hire (March 2024):** Paid for non-exclusive Inflection-2.5 license. Hired Mustafa Suleyman + Karen Simonyan + ~65 of 70 staff into newly created Microsoft AI consumer org. Used to reimburse Inflection's prior investors (MSFT was already one). UK CMA ruled "merger situation" but cleared. Reid Hoffman stayed on as Inflection director + sits on MSFT board.

**Lambda — multi-billion GPU contract (Nov 2025):** Tens of thousands of GB300 NVL72 to MSFT. Lambda concurrently raised $1.5B Series E at $5.9B post-money.

**Nebius — $19.4B 5-year contract (Sept 2025):** 100k+ GB300, 3.5+ GW. ARR target $7-9B by end 2026.

**Anthropic — $5B (Nov 2025):** MSFT's first direct check into Anthropic alongside NVDA's $10B LOI. Diversifies away from OpenAI exclusivity.

**Suno, Mistral, smaller bets.**

**GAIIP (Global AI Infrastructure Investment Partnership, Sept 17 2024):** BlackRock + GIP + MSFT + MGX, $30B initial equity / $100B target. Closed $40B acquisition of Aligned Data Centers (Oct 2025) — largest DC transaction ever (50 campuses, 78 DCs). NVDA participates as tech partner. So MSFT is also LP in a fund buying the data centers MSFT's customers (OpenAI, etc.) will lease back. Another circular vector.

## Oracle / Stargate web — the cleanest single example of recycling

**Stargate LLC structure (Jan 21, 2025 announcement):** SoftBank $19B (40%) + OpenAI $19B (40%) + Oracle $7B + MGX $7B = ~$52B equity; balance of $448B (90%!) to come from debt, vendor financing, "AI lease" instruments. 10:1 leverage from inception. SoftBank = financial responsibility (Son chairman); OpenAI = operational responsibility. Arm/MSFT/NVDA/ORCL/OpenAI = tech partners.

**ORCL ↔ OpenAI ↔ NVDA — the recycling triangle:**
- OpenAI commits $300B over 5 years (2027-2031, $60B/yr) to ORCL for compute (Sept 2025).
- ORCL guides $50B FY26 capex (up from $35B previous; up from $25B before that), mostly NVDA GB300 racks + AMD MI355X clusters + 4.5 GW Stargate DC build.
- ORCL has ~$40B earmarked for NVDA chips (incl. ~400k GB200) per FT reporting.
- NVDA invests up to $100B in OpenAI (Sept 22, 2025).
- OpenAI uses NVDA's cash to pay ORCL. ORCL uses OpenAI's contract to buy NVDA chips. NVDA books all that as revenue + holds equity in OpenAI that re-marks higher every quarter.
- Result: $250B of "AI demand" sloshes among three balance sheets that already own each other.

**ORCL stress signals:**
- Q2 FY2026: $2.1B quarterly operating cash flow vs $12B capex = -$10B free cash flow / quarter.
- $248B in new lease commitments disclosed on p.157 of Dec 10, 2025 10-Q (+148% QoQ). This is the load-bearing number.
- Debt swollen past $108B.
- 30,000 layoffs (2026) to redirect human-capital spend into the GB300 buildout.
- ORCL stock down ~24% YTD on bubble fears even as deals announced.
- HSBC: if $300B OpenAI contract slips 12-18 months on power/water/chip constraints, ORCL leverage > 4.5x → BBB-/Baa3 downgrade → borrowing costs across AI complex rise.

**SoftBank — the LP that monetized NVDA to fund Stargate:**
- Sold all remaining NVDA shares in Nov 2025 to reallocate $30B into Stargate.
- Committed $41B to OpenAI ($22.5B closed Dec 26, 2025 in tranche 2; $7.5B in April 2025 tranche 1; $11B from co-investors). Aggregate 11% OpenAI ownership.
- Vision Fund 2 vehicle.
- First $10B Stargate tranche borrowed from Mizuho + others (April 2025).

**MGX (Abu Dhabi) — sovereign wealth, also LP in MSFT's GAIIP:**
- Targeting $100B AUM, AI/AI-infra dedicated.
- Co-formed by Mubadala + G42.
- Sheikh Tahnoun bin Zayed (UAE National Security Advisor) is board chair.
- Stargate LP + GAIIP LP + Aligned Data Centers co-buyer + Binance ($2B minority via stablecoin, March 2025).
- Same Gulf dollars appear on multiple AI cap tables → counted as "demand" each time.

**Stargate site count (late 2025):** 8 GW planned / $450B+ committed (vs $500B / 10 GW original 2029 target — running ahead). 5 new US sites (Sept 2025): Shackelford TX, Doña Ana NM, Lordstown OH, Milam TX, midwest. International: Stargate UAE (May 2025, opens 2026), Stargate Norway (July 2025, hydro), Stargate Argentina (Oct 2025, $25B / 500 MW Patagonia w/ Sur Energy).

**Stargate financing reality check (Aug 7, 2025 Bloomberg):** As of last August the project had "not started" and "no funds were raised" against the original $500B headline. Almost all the announced capacity is being financed via project-finance leases (Crusoe/Blue Owl/Primary Digital Infrastructure for the Abilene site, leased to ORCL — JPM committed $2.3B debt for that one site). Stargate's role looks more like a marketing umbrella over deals each LP is doing separately than a single $500B pool.

## Circular flow examples — concrete dollars

1. **NVDA → OpenAI → ORCL → NVDA:** NVDA commits $100B to OpenAI; OpenAI commits $300B to ORCL; ORCL commits ~$40B+ to NVDA chips (400k GB200 incl.). Same dollar appears in (a) NVDA equity portfolio mark, (b) OpenAI committed-spend disclosure, (c) ORCL remaining performance obligations, (d) NVDA Q3 revenue. Triple-counted across MSCI cap-weighted indices.

2. **MSFT → OpenAI → MSFT:** MSFT puts $13B into OpenAI ($11.6B deployed). OpenAI commits $250B back to Azure through 2032. MSFT books Azure revenue; OpenAI books an expense and an investor (MSFT) which holds 27% / $135B paper-marked stake. MSFT also takes 20% revenue share up to $38B cap.

3. **NVDA → CoreWeave → NVDA:** NVDA owns ~11% / $4.9B of CoreWeave. CoreWeave's $17.3B debt is GPU-collateralized to buy NVDA chips. NVDA simultaneously has a $6.3B services contract w/ CoreWeave through 2032. MSFT is 62-67% of CoreWeave revenue. So MSFT pays CoreWeave, who pays NVDA (with debt secured by chips), and NVDA also pays CoreWeave (services) and owns CoreWeave equity that rises every time CoreWeave wins another contract. Four-way recycling.

4. **NVDA → xAI SPV → NVDA:** $7.5B equity (NVDA $2B inside) + $12.5B debt → SPV → NVDA chip purchase → SPV leases chips to xAI for 5 yrs. Debt collateralized by chips not by xAI corporate. If xAI fails to pay, lenders take chips, but chip resale market is shrinking (rental rates -50-70% on older gens). NVDA gets paid up front either way.

5. **SoftBank → OpenAI → ORCL → NVDA + Coreweave + Crusoe:** SoftBank monetizes its NVDA shares ($30B Nov 2025), recycles into Stargate + direct $41B OpenAI tranche, OpenAI commits to ORCL, ORCL buys NVDA. SoftBank is harvesting prior NVDA gains to fund the next leg of NVDA demand.

6. **Stargate LP cross-ownership:** MGX is LP in Stargate, LP in GAIIP, co-owner of Aligned Data Centers, owner-of-record of G42, which is partner in Stargate UAE. The same UAE sovereign capital is counted in (a) Stargate's $500B, (b) GAIIP's $100B target, (c) Aligned's $40B sale, (d) Stargate UAE's $10B.

7. **Altman portfolio recursion:** OpenAI's Azure spend rises → MSFT signs more PPAs (Helion / Constellation) → Altman's Helion stake re-rates → Altman uses paper wealth to write more checks into the buildout (Exowatt / Oklo / Tools for Humanity). OpenAI never had to send Helion a contract for Altman to monetize the OpenAI thesis.

8. **AMD → OpenAI → AMD:** AMD issued OpenAI warrants for 160M shares (~10% of AMD) at $0.01 strike, vesting tied to OpenAI buying 6 GW of MI450 GPUs (~$90B revenue) AND AMD stock hitting milestones up to $600/share. AMD is paying OpenAI in equity to buy AMD chips that drive AMD stock up which vests OpenAI more equity. Perfect closed loop.

## 1999 telecom parallel — what the bear case looks like

**The original setup:**
- Lucent / Nortel / Cisco vendor-financed CLECs (Covad, NorthPoint, Focal, etc.) who bought their gear.
- Industry vendor financing exploded from $3.5B in 1999 to $32.8B by Q4 2000.
- Lucent specifically held $8.1B vendor financing commitments; Nortel $7B+ (much interest-free, unsecured, tied to future purchases); Cisco $2.4B.
- Lucent committed channel-stuffing fraud ($1.148B revenue / $470M pre-tax manipulated per SEC).
- CLECs raised $82B by end-1999; industry capex doubled $56B→$120B by 2000.

**The unwind:**
- 47 CLECs declared bankruptcy 2000-2003.
- Lucent revenue $38B (1999) → $8B (2006); sold to Alcatel at $3.01/share.
- Nortel from $86.75 (July 2000) → $0.18 (2009). Filed for bankruptcy protection.
- Fiber networks were using <0.002% of capacity in 2000 — overbuild was real.

**Bull's case for why this time is different:**
- NVDA generates $50B+ annual operating cash flow vs Lucent lending more than its cash flow.
- NVDA credit rating Aa3 (upgraded March 2024) vs Lucent A3 (downgraded Dec 2000).
- NVDA's top 4 hyperscaler customers (MSFT $119B / GOOG $125B / AMZN $116B / META $91.3B operating cash flow in 2024) are real businesses with real cash. CLECs were burning capital.
- Current cap utilization is high (MSFT/AWS report AI capacity constraints), unlike fiber 2000.

**Bear's case — quantified exposure if AI capex slows:**
- NVDA equity portfolio at ~$50-150B is now ~1-3% of NVDA's market cap, but the customer concentration is extreme: top 4 customers are ~50% of NVDA data-center revenue. If MSFT/GOOG/AMZN/META trim 2026-27 capex 20%, NVDA growth flips negative in a quarter.
- CoreWeave: $99.4B backlog, 67% MSFT — if MSFT renegotiates or shifts to in-house ASICs (already happening with Maia + Cobalt), CoreWeave becomes a forced seller of depreciating GPUs into a market where rental rates already fell 50-70%.
- Neoclouds (Lambda, Crusoe, Nebius, Nscale) carry similar concentration risk; one big-customer cancellation breaks their unit economics.
- ORCL: $248B in new lease commitments + $108B debt + $300B contract from one customer (OpenAI). If OpenAI slips, ORCL is the equivalent exposure to Lucent's CLEC book.
- OpenAI is the load-bearing entity: $1.4T committed spend, $13B-ish revenue run-rate, $207B financing gap by 2030 per HSBC. The entire wheel turns on OpenAI converting consumer/enterprise subscriptions and API revenue into the cash to honor contracts. If revenue growth misses, the cascade hits NVDA (equity) → ORCL (revenue) → MSFT (Azure) → CRWV / Lambda / Crusoe (capacity) → power developers (PPAs).
- The 18x scale-vs-Lucent statistic is the headline. Even if probability of failure is far lower than 2000, the expected loss times market cap dwarfs anything that has come before.

## Cross-cutting — this node touches every other node

- **Compute (NVDA/AMD/ASIC):** NVDA's vendor-financing portfolio IS the customer base. AMD's 160M-warrant-for-6-GW deal with OpenAI is its own circular structure. Hyperscaler ASIC capex (Broadcom $350B from OpenAI; MSFT Maia; Google TPU) is what offsets / partially escapes the wheel.
- **Models:** OpenAI ($1.4T committed) + Anthropic ($10B NVDA + $5B MSFT) + xAI ($20B + $2B NVDA) + Mistral / Cohere / Reflection are all NVDA portfolio companies. The model layer is essentially a wholly NVDA-financed industry.
- **Inference / neoclouds:** CoreWeave, Lambda, Crusoe, Nebius, Nscale — every meaningful neocloud is NVDA-equity-financed and runs on GPU-collateralized debt.
- **Networking / optics:** Coherent + Lumentum $4B is NVDA financing the supply side of its own optical bottleneck.
- **Memory (HBM):** Less direct vendor-financing exposure (SK Hynix / Micron / Samsung are not capitalized by NVDA) but they sit on the same demand curve.
- **Manufacturing:** TSMC AZ + Intel Foundry stand inside NVDA's circle (Intel via $5B equity stake; TSMC indirectly via NVDA prepayments).
- **EDA / supply chain:** Synopsys / Cadence are not vendor-financed, but they price off the same buildout assumption.
- **Data centers:** Aligned Data Centers $40B acquisition by GAIIP (BlackRock/GIP/MSFT/MGX/NVDA partner) puts the DC layer inside the same LP set. Crusoe Abilene = Stargate. Blue Owl + Primary Digital Infrastructure = JV around the $2.3B JPM debt for the same site.
- **Energy / utilities / siting:** Helion (Altman/MSFT), Oklo (Altman/Meta), Constellation TMI (MSFT), Vistra/TerraPower (Meta), Exowatt (Altman) — all power PPAs are signed by the same hyperscalers and partly funded by the same individuals who own the AI-infra equity.
- **AV / robotics:** Wayve, Figure AI, Recursion are NVDA portfolio. Demand for autonomy/robotics is presented as a separate AI vertical, but the chip economics flow back to NVDA's order book.
- **China / sovereign / export control:** UAE (MGX, G42) is the cleanest case of sovereign money inside the wheel. Saudi (PIF, Humain) likely next. China-decoupling forces NVDA to fund US-domiciled customers harder to replace lost China revenue.
- **Quantum:** Quantinuum $600M is NVDA portfolio; Honeywell-spun.
- **Demand / monetization:** This node is the skeptical lens for the demand node. If OpenAI's $1.4T commitments are funded 90%+ by vendor financing and debt rather than end-user revenue, the "demand" is a financing construct, not a market.

## Sources

- [NVIDIA Investing $4B in Coherent, Lumentum (Photonics Spectra, Mar 2026)](https://www.photonics.com/Articles/NVIDIA-Investing-4B-in-Coherent-Lumentum/a72014)
- [Nvidia to invest $4 billion into Coherent and Lumentum (CNBC)](https://www.cnbc.com/2026/03/02/nvidia-investment-coherent-lumentum.html)
- [Intel completes $5B private stock sale to Nvidia (Investing.com)](https://www.investing.com/news/sec-filings/intel-completes-5-billion-private-stock-sale-to-nvidia-93CH-4423685)
- [Nvidia gives Intel a lifeline with $5B common stock deal (Tom's Hardware)](https://www.tomshardware.com/tech-industry/nvidia-gives-intel-a-lifeline-with-usd5-billion-common-stock-deal-september-deal-gets-ftc-approval-for-more-than-217-4-million-intel-shares-at-usd23-28-per-share)
- [Nvidia Increases CoreWeave Stake to 11% After Q1 2026 (IndexBox)](https://www.indexbox.io/blog/nvidia-nearly-doubles-coreweave-stake-to-over-47-million-shares-in-q1-2026/)
- [Nvidia Invests Another $2B in CoreWeave, Offers New Chip (Bloomberg)](https://www.bloomberg.com/news/articles/2026-01-26/nvidia-invests-another-2-billion-in-coreweave-offers-new-chip)
- [CoreWeave 8-K — $2B NVIDIA placement (SEC)](https://www.sec.gov/Archives/edgar/data/0001769628/000176962826000044/crwv-20260123.htm)
- [OpenAI & NVIDIA — 10 GW partnership / $100B (OpenAI newsroom)](https://openai.com/index/openai-nvidia-systems-partnership/)
- [OpenAI & NVIDIA — 10 GW partnership (NVIDIA newsroom)](https://nvidianews.nvidia.com/news/openai-and-nvidia-announce-strategic-partnership-to-deploy-10gw-of-nvidia-systems)
- [Nvidia and OpenAI ink $100B, 10GW alliance (Network World)](https://www.networkworld.com/article/4061728/nvidia-and-openai-open-100b-10-gw-data-center-alliance.html)
- [AMD–OpenAI 6 GW / 160M warrant deal (AMD)](https://www.amd.com/en/newsroom/press-releases/2025-10-6-amd-and-openai-announce-strategic-partnership-to-d.html)
- [AMD–OpenAI partnership (OpenAI)](https://openai.com/index/openai-amd-strategic-partnership/)
- [Stargate Project (OpenAI)](https://openai.com/index/announcing-the-stargate-project/)
- [Stargate LLC (Wikipedia)](https://en.wikipedia.org/wiki/Stargate_LLC)
- [SoftBank, OpenAI, Oracle, MGX commit $100B for Stargate (S&P)](https://www.spglobal.com/market-intelligence/en/news-insights/research/softbabnk-openai-oracle-and-mgx-commit-to-100b-for-stargate-ai-infrastructure)
- [SoftBank closes $41B OpenAI investment (TechInformed)](https://techinformed.com/softbank-closes-41b-openai-investment-as-stargate-buildout-expands/)
- [Oracle & OpenAI $300B Stargate deal (Data Center Frontier)](https://www.datacenterfrontier.com/machine-learning/article/55316610/openai-and-oracles-300b-stargate-deal-building-ais-national-scale-infrastructure)
- [Oracle's $300B gamble under microscope (FinancialContent)](https://markets.financialcontent.com/stocks/article/marketminute-2026-3-6-openais-return-to-growth-memo-sparks-data-center-frenzy-oracles-300-billion-gamble-under-the-microscope)
- [Oracle layoffs 2026: 30,000 cuts, $50B capex pivot (Tech Insider)](https://tech-insider.org/oracle-layoffs-2026-30000-jobs-50-billion-ai-capex-stargate/)
- [AI's trillion-dollar deal wheel (The Register)](https://www.theregister.com/2025/11/04/the_circular_economy_of_ai/)
- [Guide to $1T of AI deals (CNBC)](https://www.cnbc.com/2025/10/15/a-guide-to-1-trillion-worth-of-ai-deals-between-openai-nvidia.html)
- [OpenAI's $1T infrastructure spend (Tunguz)](https://tomtunguz.com/openai-hardware-spending-2025-2035/)
- [OpenAI wants $1T/yr infrastructure spend, Altman (Axios)](https://www.axios.com/2025/10/28/openai-1-trillion-altman)
- [OpenAI must find $207B by 2030 — HSBC (DCD)](https://www.datacenterdynamics.com/en/news/openai-must-find-207bn-to-meet-ai-data-center-spending-commitments-hsbc/)
- [The $1.4T contradiction (UFair)](https://ufair.org/blog/the--1-4-trillion-contradiction--when-actions-speak-louder-than-denials)
- [Microsoft–CoreWeave revenue concentration / 62% (mlq.ai)](https://mlq.ai/research/coreweave/)
- [CoreWeave is a time bomb (Where's Your Ed At)](https://www.wheresyoured.at/core-incompetency/)
- [CoreWeave closes $8.5B GPU-backed financing (CoreWeave IR)](https://investors.coreweave.com/news/news-details/2026/CoreWeave-Closes-Landmark-8-5-Billion-Financing-Facility-Achieving-First-Investment-Grade-Rated-GPU-backed-Financing/default.aspx)
- [CoreWeave $3.1B DDTL 5.0 (CoreWeave IR)](https://investors.coreweave.com/news/news-details/2026/CoreWeave-Closes-3-1-Billion-Loan-Facility-Expanding-Access-to-Public-Markets-for-GPU-Backed-Financing/default.aspx)
- [GPU-collateralized debt risks (Quartz)](https://qz.com/gpu-collateralized-debt-ai-neocloud-coreweave-financing-risks-050526)
- [CoreWeave $22B gamble, 40% default risk (Substack)](https://theinvestorchannel.substack.com/p/coreweaves-22b-gamble-why-the-market)
- [Microsoft–OpenAI revised deal: $38B revenue cap (Business Chief)](https://businesschief.com/news/openai-caps-microsoft-revenue-share-at-us-38bn)
- [OpenAI saves $97B through 2030 in renegotiated MSFT deal (Crypto Briefing)](https://cryptobriefing.com/openai-saves-97b-microsoft-deal/)
- [Microsoft–Inflection $650M acqui-hire (DeepLearning.AI The Batch)](https://www.deeplearning.ai/the-batch/microsoft-pays-inflection-ai-650-million-hires-most-of-its-staff)
- [Microsoft invests $1.5B in G42 (Microsoft Source)](https://news.microsoft.com/source/2024/04/16/microsoft-invests-1-5-billion-in-abu-dhabis-g42-to-accelerate-ai-development-and-global-expansion/)
- [Microsoft's $15.2B UAE investment (Microsoft On The Issues)](https://blogs.microsoft.com/on-the-issues/2025/11/03/microsofts-15-2-billion-usd-investment-in-the-uae/)
- [Microsoft's $15.2B UAE turns Gulf into US AI test case (TechCrunch)](https://techcrunch.com/2025/11/03/microsofts-15-2b-uae-investment-turns-gulf-state-into-test-case-for-us-ai-diplomacy/)
- [BlackRock + GIP + Microsoft + MGX $100B AI fund (BlackRock)](https://www.blackrock.com/corporate/newsroom/press-releases/article/corporate-one/press-releases/blackrock-global-infrastructure-partners-microsoft-and-mgx-launch-new-ai)
- [BlackRock + MGX $40B Aligned Data Centers (EnergyConnects)](https://www.energyconnects.com/news/utilities/2025/october/blackrock-mgx-make-40-billion-bet-on-ai-boom-with-aligned-data-centers-deal/)
- [MGX Fund Management (Wikipedia)](https://en.wikipedia.org/wiki/MGX_Fund_Management_Limited)
- [Microsoft–Constellation Three Mile Island 20-yr PPA (Utility Dive)](https://www.utilitydive.com/news/constellation-three-mile-island-nuclear-power-plant-microsoft-data-center-ppa/727652/)
- [Constellation secures $1B DOE loan for TMI restart (NucNet)](https://www.nucnet.org/news/constellation-secures-usd1-billion-federal-loann-for-three-mile-island-restart-11-3-2025)
- [Microsoft–Helion fusion PPA 2028 (CNBC)](https://www.cnbc.com/2023/05/10/microsoft-agrees-to-buy-power-from-sam-altman-backed-helion-in-2028.html)
- [Sam Altman's Helion stake scrutinized in Musk trial / Capitol Hill (GeekWire)](https://www.geekwire.com/2026/openai-ceo-sam-altmans-stake-in-helion-energy-draws-scrutiny-in-musk-trial-and-on-capitol-hill/)
- [Altman holds >$2B in OpenAI-tied firms (BanklessTimes)](https://www.banklesstimes.com/articles/2026/05/14/sam-altman-holds-over-2b-stake-in-firms-tied-to-openai-court-filing-shows/)
- [Altman investments scrutinized in Musk lawsuit (The News)](https://www.thenews.com.pk/latest/1402481-openai-chief-sam-altman-s-investments-draw-scrutiny-in-musk-lawsuit)
- [Sam Altman's Oklo stake — $650M / 4.3% (Granite Firm blog)](https://www.granitefirm.com/blog/us/2025/12/28/oklo-smr-sam-altman/)
- [Meta nuclear deals w/ Vistra, TerraPower, Oklo for Prometheus (Fortune)](https://fortune.com/2026/02/07/next-gen-nuclear-tipping-point-meta-hyperscalers-bill-gates-terrapower-sam-altman-oklo/)
- [Exowatt $50M extension Nov 2025 (BusinessWire)](https://www.businesswire.com/news/home/20251112677469/en/Exowatt-Raises-Additional-$50-Million-to-Accelerate-U.S.-Rollout-of-Dispatchable-Solar-for-the-AI-Era)
- [Sam Altman-backed Exowatt $50M raise (TechCrunch)](https://techcrunch.com/2025/11/13/sam-atlman-backed-exowatt-wants-to-power-ai-data-centers-with-billions-of-hot-rocks/)
- [World (Worldcoin) / Tools for Humanity (Wikipedia)](https://en.wikipedia.org/wiki/World_(blockchain))
- [Sam Altman-backed World launches in US (Fortune)](https://fortune.com/crypto/2025/04/30/worldcoin-world-sam-altman-united-states-launch/)
- [World token jumps on OpenAI biometric social network report (CoinDesk)](https://www.coindesk.com/business/2026/01/28/world-token-jumps-27-as-sam-altman-reportedly-eyes-a-biometric-social-network-to-kill-off-bots)
- [Nvidia–xAI $2B / $20B Colossus 2 deal (Tom's Hardware)](https://www.tomshardware.com/pc-components/gpus/nvidia-backs-20-billion-xai-chip-deal)
- [xAI $20B financing tied to NVDA chips (Bloomberg)](https://www.bloomberg.com/news/articles/2025-10-07/musk-s-xai-nears-20-billion-capital-raise-tied-to-nvidia-chips)
- [Nvidia-backed Lambda raises $480M Series D (PitchBook)](https://pitchbook.com/news/articles/nvidia-backed-lambda-raises-480m-as-ai-neocloud-funding-surges)
- [NVentures / Nvidia 67 venture deals 2025 (AI Business Weekly)](https://aibusinessweekly.net/p/nvidia-67-venture-deals-2025-ai-ecosystem-investments)
- [Nvidia startup investments tracker (AI Funding Tracker)](https://aifundingtracker.com/nvidia-startup-investments/)
- [Circular financing: NVDA's $110B bet vs telecom bubble (Tunguz)](https://tomtunguz.com/nvidia_nortel_vendor_financing_comparison/)
- [Vendor financing parallels to dot-com (KB Securities)](https://rdata.kbsec.com/pdf_data/20251022133123807E.pdf)
- [Who lost Lucent? (American Affairs Journal)](https://americanaffairsjournal.org/2020/08/who-lost-lucent-the-decline-of-americas-telecom-equipment-industry/)
- [Hidden risk in AI's circular financing (Columbia)](https://blogs.cuit.columbia.edu/gjb2124/circular-financing/)
- [Nvidia round-tripping or vendor financing (RIA)](https://realinvestmentadvice.com/resources/blog/nvidia-deals-round-tripping-or-vendor-financing/)
- [Another OpenAI entanglement reopens dot-com fears (CNN)](https://www.cnn.com/2025/10/07/business/openai-nvidia-bubble-nightcap)
- [The AI hype triumvirate: NVDA/OpenAI/Oracle circular bet (Substack)](https://pshi.substack.com/p/the-ai-hype-triumvirate-nvidia-openai)
- [The Stargate Deception (Substack)](https://shanakaanslemperera.substack.com/p/the-stargate-deception)

## _new_nodes_suggested

- **K1a — OpenAI as load-bearing entity:** dedicated node on the $1.4T commitment stack, $207B HSBC financing gap, revenue trajectory required to honor it, restructuring path, MSFT 20%-rev-share cap, IPO timing. Every other node has OpenAI as a hidden dependency.
- **K1b — GPU-collateralized debt asset class:** CoreWeave DDTL 1.0→5.0, Crusoe SPV, xAI SPV, Blue Owl/Primary Digital Infra JV, JPM $2.3B Stargate Abilene. Investment-grade chip-collateral debt is a brand-new asset class with no default-cycle history.
- **K1c — Sovereign wealth in AI infra (MGX / PIF / Humain / GIC / Temasek / Mubadala):** Gulf + Asian sovereign capital is increasingly the marginal LP. Cross-border + dual-use export-control friction.
- **K1d — Hyperscaler ASIC escape velocity:** MSFT Maia/Cobalt, GOOG TPU, Meta MTIA, AWS Trainium/Inferentia. To what degree do hyperscaler in-house chips break the NVDA wheel? Broadcom's $350B from OpenAI sits at this seam.
- **K1e — Altman conflict-of-interest perimeter:** Musk lawsuit, 10-state AG letter, board recusal standards, IPO disclosure requirements if OpenAI files. Could force partial unwind of the orbit.
- **K1f — Vendor-financing asset-quality monitor:** running tracker of (a) NVDA equity portfolio MTM vs cost, (b) ORCL RPO ($248B leases) vs operating cash flow, (c) CoreWeave debt-service coverage, (d) neocloud GPU rental-rate index.
- **K1g — Bubble unwind scenario model:** quantify cascade if OpenAI capex slips 12-18 months: NVDA revenue impact, ORCL leverage to 4.5x, CRWV refi wall, hyperscaler PPA stranding, neocloud bankruptcy probability.

---

## Announced vs deployed scoreboard

## The thesis

The AI infrastructure cycle is awash in **gigawatt-scale press releases**. The skeptical investor's job is to sort signal from noise — to classify every announcement into a five-tier ladder:

1. **DEPLOYED** — actually running, drawing power, generating revenue
2. **UNDER CONSTRUCTION** — broken ground, capex committed, supply chain locked
3. **SIGNED PPA / CONTRACT** — binding, definitive, FERC-cleared or equivalent
4. **LOI / MOU** — non-binding, often phrased like a contract in the press release
5. **VAPOR** — press release only, no counterparty detail, no permits, no power

Applying this lens to mid-2026's biggest commitments reveals a familiar pattern: the headline GW numbers are dominated by Tier 4 and Tier 5. The tightest, most binding commitments are concentrated in hyperscaler capex (real cash going out the door this quarter) and a handful of operating restarts. The **gap between announced and deployed is widest in nuclear SMR/advanced reactor power** (where almost everything is 2030+ pre-construction) and **sovereign AI** (UAE and Saudi have one early supercomputer each behind multi-GW headlines).

The 1999 telecom analogy: in 1999-2000, carriers announced ~80M route-miles of long-haul fiber against ~5M actually lit. In 2026, AI infra has announced **~50+ GW** of new GPU-tied power across two years versus **~4 GW operational** at hyperscale dedicated AI sites. The ratio is similar; the difference is that this cycle's announcements are mostly backed by either (a) hyperscalers actually spending the cash today or (b) startups whose announcements *are* their financing.

## Compute commitments scoreboard

| Deal | Announced | Capacity | Status | Notes |
|---|---|---|---|---|
| **AMD-OpenAI** | Oct 2025 | 6 GW | **SIGNED + WARRANT, 0% DEPLOYED** | Definitive agreement. 160M-share warrant at $0.01 vesting in tranches tied to 1 GW deploy + $600 stock target. First 1 GW of MI450 ships H2 2026. No warrant tranche vested yet. |
| **AMD-Meta** | Feb 24, 2026 | 6 GW | **SIGNED + WARRANT, 0% DEPLOYED** | Identical structure (160M warrants, $0.01 strike, $600 target). $60B headline, ~$10B+ per GW. First shipments H2 2026 on MI450 + Venice EPYC + Helios racks. |
| **Anthropic-Amazon (Trainium)** | Apr 20, 2026 | 5 GW / $100B | **SIGNED, ~1 GW BY YE26** | Binding 10-year commitment. Trainium2 capacity online Q2 2026; ~1 GW combined Trainium2/3 by YE 2026. Remaining ~4 GW spans 2027-2029 on Tn3/Tn4. Project Rainier already operational (>1M Trainium2 chips). |
| **xAI Colossus 1M GPUs** | 2024 target | 1M by YE26 | **~555K DEPLOYED, on track-ish** | 555K GPUs / 2 GW across Memphis as of Jan 2026 (~55% of target). May 6 2026: Colossus 1 (~220K H100s, 300 MW) leased/sold to Anthropic. Training shifted to Colossus 2 (~550K Blackwell). MACROHARDRR Mississippi site = path to 1M but unconfirmed energization date. |
| **Stargate Abilene 1.2 GW** | Sep 2024 | 1.2 GW | **PARTIALLY LIVE** | Crusoe-built. 2 of 8 buildings operational on GB200 since Sep 2025 (~0.3 GW). Remaining 6 scheduled mid-2026. The 600 MW expansion (to 2.1 GW) was **canceled**; capacity redirected to MSFT-Crusoe adjacent campus. |
| **Stargate $500B / 10 GW** | Jan 21, 2025 | 10 GW | **VAPOR-ADJACENT** | $52B committed equity (SoftBank $19B, OpenAI $19B, Oracle $7B, MGX $7B). Remaining 90% to debt + vendor finance. OpenAI cut spend pledge from $1.4T to $600B Feb 2026; pivoted to renting from AWS/Azure/CoreWeave/GCP. SoftBank seeking $40B loan to fund its share. |

## Power commitments scoreboard

| Deal | Announced | Capacity | Status | Notes |
|---|---|---|---|---|
| **Oklo-Meta (Ohio/Pike Co)** | Jan 2026 | 1.2 GW | **PARTNERSHIP, NOT PPA** | Long-term campus development. Pre-construction 2026, first phase online ~2030. Uprated Aurora to 75 MW. Not a binding PPA. |
| **Oklo-Wyoming Hyperscale** | LOI → PPA | 100 MW | **SIGNED 20-yr PPA** | Originally LOI, formalized as binding 20-yr PPA. First Aurora reactor target: 2027. |
| **Oklo-Vertiv** | 2025 | n/a | **TECH COLLAB, NOT POWER** | Cooling + steam pilot integration. Not a PPA. Frequently misreported as a power deal. |
| **Oklo-Switch (Master Power Agreement)** | Dec 2024 | up to 12 GW | **LOI / MPA (non-binding)** | Headline 12 GW through 2044. Non-binding. The single largest vapor line on Oklo's pipeline. |
| **Oklo total pipeline** | cumulative | >14 GW | **MOSTLY LOI** | Of >14 GW pipeline, only Wyoming Hyperscale 100 MW + Equinix 500 MW + handful of MOUs. <5% binding by capacity. |
| **TerraPower Kemmerer 1** | Apr 23, 2026 | 345-500 MW | **UNDER CONSTRUCTION** | NRC Part 50 permit granted Mar 4, 2026. Groundbreaking Apr 23, 2026. 42-month build. Target COD 2030-2031. Site work since Jun 2024. **First utility-scale advanced reactor in US construction.** |
| **TerraPower-Meta (8 reactors)** | Jan 2026 | up to 2.8 GW | **MOU, FIRST 2 BY 2032** | 8-reactor commercial framework. First two targeted 2032; rest 2035. Non-binding but visible roadmap. |
| **X-energy Dow Seadrift** | 2023, ongoing | 320 MW (4×80 MW) | **NRC REVIEW ADVANCING** | FONSI (Finding of No Significant Impact) issued mid-May 2026. CPA approval expected Q1-2027. COD likely early/mid 2030s. |
| **X-energy Amazon / Energy Northwest** | 2024 | up to 5 GW | **EQUITY + LOI** | Amazon made equity investment in X-energy. EN partnership remains pre-LOI on power; capacity headline not contractual. |
| **X-energy-Talen** | Mar 2026 | ~1 GW | **LOI** | Evaluating 3+ four-unit Xe-100 plants in PJM. Non-binding. |
| **NuScale post-UAMPS** | 2024-2026 | n/a binding | **ZERO HARD CONTRACTS** | RoPower (Romania) FID slipped to late 2026/early 2027. TVA/Entra1 6 GW / 72 reactors deal is **non-binding**. Iceberg Research flagged office-sharing concerns. CEO 2025 two-or-three-customers-by-YE25 target missed. |
| **Constellation TMI / Crane (MSFT)** | Sep 2024 | 835 MW + 30 MW uprate | **PPA SIGNED, RESTART ON TRACK** | PPA commences Jun 2027 (pulled forward from 2028). NRC review tracking 2027 completion. 65% staffed by mid-2025; main generator and turbines tested. PJM interconnection pending. |
| **Talen-AWS Susquehanna** | restructured Jun 2025 | 1,920 MW | **SIGNED FTM PPA** | Original BTM ISA rejected by FERC Nov 2024 (upheld on rehearing). Restructured as front-of-the-meter retail PPA — no FERC approval needed. ~$18B contract through 2042. Transition from existing 300 MW BTM happens spring 2026 during Susquehanna refueling outage. |
| **Vistra-AWS Comanche Peak** | Feb 26, 2026 | ~3,800 MW | **SIGNED PPA** | Reported in Vistra Q4 2025 earnings. Plus separate Vistra-Meta >2,600 MW across PJM nuclear. Supports 20-yr license renewal for all 4 Comanche Peak units. |
| **Vistra Cogentrix acquisition** | 2025 | 5,500 MW gas | **PENDING CLOSE** | Closes mid-to-late 2026. (This is the mid-2026 close — *not* the AWS PPA, which is already signed.) |

## Hyperscaler capex actual vs guide

| Company | 2026 Guide | Q1 2026 Actual | Implied 2H26 Run-Rate | Read |
|---|---|---|---|---|
| **Microsoft** | ~$190B (CY26) | $31.9B (Q3 FY26, Mar qtr) | $40B+ guided Q4 FY26; ~$120B H2 CY26 needed | Real money. CY26 number includes ~$25B from memory price inflation, not pure volume. Backlog $627B (+99% YoY). |
| **Oracle** | ~$50B (FY26) | $12B (Q2 FY26 Nov qtr) | TTM as of Feb 2026 = $48.25B | On track. RPO ballooned to $523B. Negative FCF $10B in Q2 FY26. Debt >$100B + $248B off-BS leases. |
| **Amazon** | ~$200B (CY26) | $44.2B (Q1 CY26) | Annualizing ~$177B, accelerating into H2 | Tracking light vs guide but Jassy explicit about customer commitments (Anthropic $100B etc). AWS backlog $364B. |
| **Alphabet** | $180-190B (raised from $175-185B) | $35.7B (Q1 CY26) | Annualizing $143B, needs material H2 step-up | CFO guides 2027 to significantly increase. Google Cloud backlog $460B. Increase tied partly to Intersect acquisition close. |
| **Meta** | $125-145B (raised from $115-135B) | $19B (Q1 CY26) | Annualizing $76B; **steep H2 ramp implied** | Largest gap between Q1 pace and guide of any hyperscaler. Stock dropped 7% on the guidance raise. Justified by 1-5 GW per-site projects + Louisiana $27B campus. |
| **Top 5 combined** | >$700B for 2026 | n/a | n/a | Nearly 2x 2025 spend and $100B above just-prior-quarter guides. |

## Sovereign + neocloud scoreboard

| Deal | Announced | Headline | Actual Status | Notes |
|---|---|---|---|---|
| **Stargate UAE (G42)** | May 2025 | 1 GW (200 MW Phase 1) | **UNDER CONSTRUCTION, Q3 2026 PHASE 1** | Civil/MEP advanced. 35,000 GB300 export license granted Nov 2025. Remaining 800 MW + broader 5 GW UAE-US AI Campus = no firm dates; ongoing talks with US hyperscalers complicated by China-ties scrutiny. |
| **Saudi HUMAIN-NVIDIA** | May 2025 | several hundred thousand GB300 over 5 yrs / 500 MW | **18K GB300 PHASE 1 CONFIRMED** | First supercomputer = 18K GB300. PIF-backed. AMD parallel $10B collaboration. Stated 600K target = press characterization, not contractual. |
| **India AI Mission** | 2024 | 100K GPUs by YE26 | **38K+ DEPLOYED, 20K MORE IN PIPELINE** | Genuinely ahead of original 10K target. Mix of H100/H200/L4 + Trillium TPUs. Subsidized at Rs 65-150/hr. Power/cooling bottleneck cited as gating constraint. |
| **EU InvestAI 200B EUR** | Feb 11, 2025 | 200B EUR (20B public + 150B private leverage) | **20B EUR PUBLIC COMMITTED, FUND STILL FORMING** | H1 2026 = legal finalization phase. 4 gigafactories targeted 2027-2028 operational. First proposals call Q4 2025. The 200B EUR figure = 10x leverage assumption; private piece not raised. |
| **CoreWeave** | n/a | $99.4B backlog | **REAL CONTRACTS, REAL LOSSES** | Q1 2026: $2.08B revenue (+112% YoY), $740M GAAP net loss, $7.7B Q1 capex, total debt $24.9B. New bookings $40B+ in Q1 alone → book-to-bill ~19x. Largely sold out of 2026 capacity. Largest non-hyperscaler proxy for the cycle. |
| **Crusoe** | n/a | $2B 2026E revenue | **ON TRACK** | $998M 2025 revenue (+262% YoY). Abilene Phase 1 alone now $250M of 2026 revenue (25x original projection). 17x TCV growth, 5x cloud bookings growth, 45 GW power pipeline. Adding 900 MW MSFT campus + 2.1 GW Abilene footprint. |
| **Lambda** | n/a | H1 2026 IPO | **DELAYED to H2 2026+** | No S-1 filed. Raised $1.5B Series E (Nov 2025, TWG-led) + $350M pre-IPO convertibles (Mubadala-led) at 20% IPO discount with 1-yr penalty clause. ~$505M ARR May 2025. |

## Cross-cutting

**Most exposed to the announced-vs-deployed gap:**

- **K1 (nuclear power for AI):** Almost the entire SMR/advanced reactor pipeline is Tier 4-5. Kemmerer is the only utility-scale advanced reactor under construction. Oklo's headline pipeline is >90% LOI/MOU. NuScale has zero binding customers post-UAMPS. X-energy's first reactor is gated by NRC into Q1 2027 minimum.
- **K3 (sovereign AI):** UAE Phase 1 (200 MW) and India (~38K GPUs) are the only sovereign initiatives with real iron in the ground. UAE 5 GW expansion, Saudi 600K total, EU 200B EUR all have order-of-magnitude gaps between headline and binding capital.
- **K4 (Stargate / OpenAI infrastructure):** The $500B → $1.4T → cut-to-$600B pivot, plus the 600 MW Abilene cancellation, plus pivoting to renting from hyperscalers, plus SoftBank's $40B loan-seeking — this is the single deal most exhibiting telecom-1999 dynamics in 2026.
- **K5 (AMD non-Nvidia compute):** OpenAI + Meta = 12 GW of AMD commitments backed by warrants, but **zero GPUs shipped yet** under either deal. H2 2026 MI450 ramp is the gating event. Both deals are equity-incentive-aligned but not legally take-or-pay.

**Stickiest announcements (heavy press, weakest contract):**

1. **Stargate $500B / 10 GW** — became $1.4T then $600B then pivoted to rentals
2. **Oklo-Switch 12 GW MPA** — non-binding, 20-year horizon
3. **NuScale-TVA/Entra1 6 GW / 72 reactors** — non-binding
4. **X-energy-Amazon 5 GW** — equity stake but no PPA
5. **EU InvestAI 200B EUR** — 20B EUR real, 180B EUR = leverage assumption
6. **Saudi HUMAIN 600K GB300** — 18K confirmed, rest several-hundred-thousand over 5 yrs
7. **TerraPower-Meta 8 reactors** — first 2 in 2032, rest 2035, MOU

**The genuinely binding tier (Tier 1-3) of new announcements totals roughly:**
- Operating restarts/uprates: ~3.0 GW (TMI Crane, Talen FTM, Vistra-AWS, Vistra-Meta, Constellation uprates)
- Hyperscaler self-build dedicated AI capex 2026: ~$700B combined — the only number unambiguously real
- Trainium/Anthropic 1 GW by YE26: real
- Stargate Abilene 1.2 GW: ~0.3 GW live, ~1.2 GW by mid-26: real
- Crusoe operating pipeline: real

**Everything else is conditioned on power, permits, or pre-money.**

## Sources

- [OpenAI: AMD-OpenAI 6 GW strategic partnership](https://openai.com/index/openai-amd-strategic-partnership/)
- [AMD IR: AMD-OpenAI 6 GW release](https://ir.amd.com/news-events/press-releases/detail/1260/amd-and-openai-announce-strategic-partnership-to-deploy-6-gigawatts-of-amd-gpus)
- [DCD: AMD-OpenAI 6 GW, 1 GW from 2026](https://www.datacenterdynamics.com/en/news/amd-to-supply-openai-with-6gw-worth-of-gpus-plans-1gw-deployment-starting-in-2026/)
- [AMD-Meta 6 GW partnership Feb 2026](https://www.amd.com/en/newsroom/press-releases/2026-2-24-amd-and-meta-announce-expanded-strategic-partnersh.html)
- [CNBC: Meta 6 GW AMD deal](https://www.cnbc.com/2026/02/24/meta-to-use-6gw-of-amd-gpus-days-after-expanded-nvidia-ai-chip-deal.html)
- [Register: Meta-AMD chips-for-stock deal](https://www.theregister.com/2026/02/24/amd_copypastes_openai_6gw_chipsforstock/)
- [Anthropic: Amazon collaboration 5 GW](https://www.anthropic.com/news/anthropic-amazon-compute)
- [TechCrunch: Anthropic $5B Amazon, $100B AWS](https://techcrunch.com/2026/04/20/anthropic-takes-5b-from-amazon-and-pledges-100b-in-cloud-spending-in-return/)
- [Introl: xAI Colossus 2 GW, 555K GPUs](https://introl.com/blog/xai-colossus-2-gigawatt-expansion-555k-gpus-january-2026)
- [Wikipedia: Colossus supercomputer](https://en.wikipedia.org/wiki/Colossus_(supercomputer))
- [DCD: Crusoe Abilene officially live](https://www.datacenterdynamics.com/en/news/crusoes-abilene-data-center-officially-live-serving-oracle-and-openais-stargate/)
- [Epoch AI: OpenAI Stargate US sites](https://epoch.ai/blog/openai-stargate-where-the-us-sites-stand)
- [TechTimes: OpenAI Stargate cut from $1.4T to $600B](https://www.techtimes.com/articles/316807/20260519/openai-cut-stargates-spending-pledge-14-trillion-600-billion-now-renting-what-it-vowed-build.htm)
- [The Tech Portal: Stargate funding hurdles](https://thetechportal.com/2026/02/24/openais-500bn-stargate-project-faces-early-delays-amid-partner-disputes-and-funding-challenges-report/)
- [Data Center Frontier: Oklo-Wyoming Hyperscale 100 MW PPA](https://www.datacenterfrontier.com/energy/article/55054838/oklo-forges-20-yr-nuclear-ppa-with-wyoming-hyperscale-for-100-mw-of-data-center-power)
- [Power Mag: Meta 6.6 GW nuclear deals (Oklo, Vistra, TerraPower)](https://www.powermag.com/meta-locks-in-up-to-6-6-gw-of-nuclear-power-through-deals-with-vistra-oklo-and-terrapower/)
- [ANS Newswire: TerraPower Kemmerer construction begins Apr 2026](https://www.ans.org/news/2026-04-24/article-7975/terrapower-begins-construction-on-natrium-power-plant-in-kemmerer/)
- [TerraPower official: Kemmerer construction start](https://www.terrapower.com/TerraPower-Commences-Construction-on-Americas-First-Utility-Scale-Advanced-Nuclear-Power-Plant)
- [X-energy: NRC FONSI for Seadrift](https://x-energy.com/news/nrc-issues-environmental-assessment-with-finding-of-no-significant-impact-for-dow-and-x-energys-propsed-advanced-nuclear-project-in-texas/)
- [SEC: X-energy Form 8-K FY2026](https://www.sec.gov/Archives/edgar/data/0002088896/000208889626000005/xe-ex99_1.htm)
- [Iceberg Research: NuScale TVA/Entra1 critique](https://iceberg-research.com/2025/11/14/nuscale-wants-to-sell-72-reactors-to-a-company-based-in-a-wework-office-shared-with-nuscale/)
- [Utility Dive: Constellation TMI 2028 restart](https://www.utilitydive.com/news/constellation-three-mile-island-nuclear-power-plant-microsoft-data-center-ppa/727652/)
- [DCD: TMI restart pulled forward to 2027](https://www.datacenterdynamics.com/en/news/three-mile-island-nuclear-plant-restart-ahead-of-schedule-in-boon-to-microsofts-ai-ambitions-report/)
- [Power Mag: Talen-AWS $18B FTM restructured PPA](https://www.powermag.com/talen-amazon-launch-18b-nuclear-ppa-a-grid-connected-ipp-model-for-the-data-center-era/)
- [ANS: FERC rejects Talen-Amazon ISA](https://www.ans.org/news/article-6534/ferc-rejects-interconnection-deal-for-talenamazon-data-centers/)
- [Power Engineering: Vistra co-location discussions](https://www.power-eng.com/business/vistra-engaged-in-co-location-discussions-with-data-centers/)
- [CNBC: Microsoft $190B 2026 capex](https://www.cnbc.com/2026/04/29/microsoft-msft-q3-earnings-report-2026.html)
- [Global Data Center Hub: MSFT Q3 FY26 $190B plan](https://www.globaldatacenterhub.com/p/microsoft-q3-fy2026-the-190b-capex)
- [Futurum: Oracle Q2 FY26 capex rises](https://futurumgroup.com/insights/oracle-q2-fy-2026-cloud-grows-capex-rises-for-ai-buildout/)
- [Fierce Network: Oracle $523B RPO](https://www.fierce-network.com/cloud/oracles-order-backlog-soars-past-half-trillion-dollars)
- [CNBC: Amazon Q1 2026 capex $44.2B](https://www.cnbc.com/2026/04/29/amazon-amzn-q1-earnings-report-2026.html)
- [Global Data Center Hub: AMZN Q1 FY26 silicon pivot](https://www.globaldatacenterhub.com/p/amazon-q1-fy2026-the-silicon-pivot)
- [CNBC: Alphabet raises 2026 capex to $180-190B](https://www.cnbc.com/2026/04/29/alphabet-googl-q1-2026-earnings.html)
- [Fortune: Meta raises 2026 capex to $125-145B](https://fortune.com/2026/04/29/meta-zuckerberg-145-billion-ai-spending-roi/)
- [PR Newswire: G42 Stargate UAE construction update](https://www.prnewswire.com/news-releases/g42-provides-update-on-construction-of-stargate-uae-ai-infrastructure-cluster-302586430.html)
- [The National: Stargate UAE Phase 1 Q3 2026](https://www.thenationalnews.com/business/2025/12/05/stargate-uaes-first-phase-to-be-completed-in-third-quarter-of-2026/)
- [DCD: HUMAIN 18,000 GB300 chips](https://www.datacenterdynamics.com/en/news/saudi-arabian-ai-venture-humain-buys-18000-nvidia-gb300-chips-several-hundred-thousand-more-on-the-way/)
- [NVIDIA Newsroom: HUMAIN-NVIDIA partnership](https://nvidianews.nvidia.com/news/humain-and-nvidia-announce-strategic-partnership-to-build-ai-factories-of-the-future-in-saudi-arabia)
- [DD News: IndiaAI 34,000 GPUs](https://ddnews.gov.in/en/indiaai-mission-gets-boost-as-compute-capacity-tops-34000-gpus/)
- [EE Times: India AI Mission 2.0 adds 20K GPUs](https://www.eetimes.com/india-to-add-20000-gpus-as-ai-mission-2-0-expands-compute-and-chip-push/)
- [EC: EU launches InvestAI 200B EUR](https://digital-strategy.ec.europa.eu/en/news/eu-launches-investai-initiative-mobilise-eu200-billion-investment-artificial-intelligence)
- [EIB: EIB joins InvestAI gigafactories financing](https://www.eib.org/en/press/all/2025-491-eib-group-and-european-commission-join-forces-to-finance-ai-gigafactories)
- [CoreWeave IR: Q1 2026 results, $99.4B backlog](https://investors.coreweave.com/news/news-details/2026/CoreWeave-Reports-Strong-First-Quarter-2026-Results/)
- [CNBC: CoreWeave Q1 2026](https://www.cnbc.com/2026/05/07/coreweave-crwv-q1-earnings-report-2026.html)
- [Sacra: Crusoe revenue, valuation](https://sacra.com/c/crusoe/)
- [DCD: Crusoe 4.5 GW natural gas](https://www.datacenterdynamics.com/en/news/crusoe-secures-45gw-of-natural-gas-for-ai-data-centers-report/)
- [Sacra: Lambda IPO outlook](https://sacra.com/research/lambda-ipo/)
- [DCD: Lambda $350M pre-IPO funding](https://www.datacenterdynamics.com/en/news/lambda-in-talks-to-raise-350m-in-pre-ipo-funding-report/)

_new_nodes_suggested:
- **AI lease instruments and vendor financing** — the $448B Stargate gap is explicitly to be filled with structured AI-lease securitizations and vendor finance. Untested asset class. Worth a dedicated node tracking JPM/Apollo/Blue Owl structuring.
- **PJM grid + FERC co-location doctrine** — Talen FTM model, FERC's BTM rejection, PJM interconnection queue length, and the precedent for converting nuclear MWh into hyperscaler retail load. Affects every future nuclear-AI PPA.
- **AMD warrant economics as a hyperscaler template** — OpenAI + Meta now both have $0.01 strike, deployment-linked AMD warrants. If a third hyperscaler signs (Google? Anthropic?), this becomes the dominant non-Nvidia GPU procurement model.
- **HBM4 / advanced packaging as the gating constraint** — Lisa Su explicitly cited HBM + packaging as the long pole. Memory price inflation drove $25B of MSFT's $190B figure. Worth a dedicated supply node.
- **Anthropic's compute portfolio (multi-vendor)** — Anthropic now spans Trainium ($100B), Google TPU (existing), and now Colossus 1 H100s (May 6 2026 deal). The only frontier lab with three-vendor compute backing simultaneously.
- **Off-balance-sheet lease accounting at Oracle** — $248B in OBS lease commitments vs $100B on-BS debt. The clearest example of how AI capex is being structured to keep headline leverage manageable while real obligations balloon.

---

## Single points of failure

## The thesis

The AI buildout is celebrated as a story of abundance — trillion-dollar capex, hyperscaler arms races, gigawatt-scale campuses. The opposite story is the more interesting one. A surprisingly large number of *individual* companies, materials, and physical inputs sit on the critical path with **no qualified substitute inside a six-month window**, and in some cases no substitute inside a decade. A serious disruption at any one of them — fire, earthquake, strike, export-control escalation, Chapter 11, geopolitical event — cascades immediately into hyperscaler capex schedules, GPU shipments, or grid interconnect timelines.

The pattern isn't "vertically integrated incumbent dominates" (the normal oligopoly story). It's stranger:

- A **Japanese food-additive company** (Ajinomoto) controls 95% of the resin film every advanced CPU/GPU substrate is built on.
- A **MSG-byproduct line of business** is the single largest dependency for Nvidia's substrate supply.
- The **only Western HALEU enrichment facility** is one demo plant in Piketon, Ohio (Centrus), producing 900 kg/year — enough to fuel roughly one SMR core load.
- The **only commercial actinic EUV mask inspection tool** is made by Lasertec; ~90% market share, two-year delivery.
- The **only company shipping 200G-per-lane EML lasers at volume** for 1.6T transceivers is Lumentum — which is why Nvidia put $2B on the table in March 2026 to lock up capacity.
- The **only US producer of grain-oriented electrical steel** is Cleveland-Cliffs' Butler Works — every domestic transformer manufacturer draws from one source.
- The **only operating US rare-earth mine of scale** is Mountain Pass (MP Materials); China still refines ~90% of *heavy* rare earths (Dy, Tb).
- The **only EUV lithography vendor on Earth** is ASML; 30-year head start, no competitor inside this decade.

The synthesis insight: when people say "AI is gated by power and chips," they're abstracting away a more accurate statement — AI is gated by ~25 named entities, most of which are *not* household names, several of which are pre-bankrupt or post-bankrupt (Wolfspeed), and several of which sit inside the geopolitical fault line that runs from Hsinchu through Yokkaichi to Pyeongtaek.

A disruption at any single SPOF below would reset the AI capex curve by 6–24 months. The list is the map of where the buildout actually breaks.

## SPOF inventory

| SPOF | Owner | Why no alt | Impact of 6-mo disruption | Mitigation timeline |
|---|---|---|---|---|
| **EUV lithography systems** | ASML (NL) | 100% monopoly; Nikon/Canon exited a decade ago; xLight/Canon nanoimprint are 5–10 yrs out | Hard stop on all sub-7nm logic, HBM, and high-end memory worldwide; entire AI roadmap freezes | None inside 5 yrs (xLight DOE-funded, Canon NIL niche-only) |
| **High-NA EUV scanners** | ASML (NL) | Sole supplier, $400M/system; Intel, TSMC, Samsung the only customers who can afford | 1.4nm node and below frozen; A14/N2P/14A all stall | None — High-NA *is* the alternative; Hyper-NA only conceptual through 2030s |
| **EUV photomask inspection (actinic)** | Lasertec (JP) | ~90% share; only tool inspecting at 13.5nm wavelength; 2-yr delivery lead time | EUV masks can't be qualified; effectively halts <7nm production | KLA multi-beam e-beam 2–3 yrs; no actinic alternative |
| **EUV photoresist (high-end)** | JSR + TOK + Shin-Etsu (JP) | Japan provides 100% of <7nm EUV resist; 95% of all high-end EUV resist | All advanced node fabs lose patterning chemistry; Korean/Chinese alternatives <5% capable | JSR Korea MOR plant late 2026; deep technical gap for non-JP supply |
| **Advanced packaging (CoWoS)** | TSMC (TW) | >85% of CoWoS capacity locked through 2026; Intel EMIB and Samsung I-Cube years behind on yield | Nvidia/AMD/Broadcom AI accelerators can't ship; AI training cluster builds delayed | Intel EMIB ramp 2H 2026; Amazon/Google qualifying as 2nd source |
| **HBM3e / HBM4** | SK Hynix (KR) | ~62% HBM share Q2 2025; 70% of Nvidia Rubin HBM4 allocation; sold out through 2026 | Nvidia GB300/Rubin shipments throttle; Samsung HBM4 only at 11Gb/s tier; Micron capacity insufficient | Samsung qualified Q1 2026 but trailing; Micron HBM4 ramp mid-2026 |
| **ABF substrates (Ajinomoto Build-up Film)** | Ajinomoto Fine-Techno (JP) | >95% share; Sekisui ~5%; new Ajinomoto Gifu plant doesn't open until 2032 | Every GPU/CPU substrate stops; 30% Q3 2026 price hike already in effect | New capacity 2032; glass substrate 5–10 yrs |
| **InP EML lasers (200G/lane)** | Lumentum (US) | Only volume shipper of 200G EMLs for 1.6T; InP yields 15–50%; Nvidia paid $2B for priority | 1.6T transceiver buildout halts; AI training network bandwidth ceiling hit | Coherent ramping 6" InP in Sherman TX; competitor timelines past 2027 |
| **InP substrate wafers** | AXT + JX Metals + Coherent (3 firms own >95%) | 70% demand-supply gap in 2025; orders booked through 2026 | All photonics — transceivers, CW lasers, photodetectors — supply constrained | AXT 6" expansion 2026–27; Coherent 6" Sherman ramping |
| **Advanced silicon wafers (300mm)** | Shin-Etsu + SUMCO (JP) | Combined >50% of 300mm; tight oligopoly | Logic + memory wafer starts globally constrained | GlobalWafers Sherman TX Phase 2 ramps 2027 |
| **HALEU enrichment (Western)** | Centrus Energy (US) | Only NRC-licensed US HALEU producer; 900 kg/yr; only non-Russian source | Most advanced reactors / SMRs cannot fuel; Russia is only commercial alternative | DOE $2.7B across Centrus/Orano/General Matter; Phase III 2026–2034 |
| **Grain-Oriented Electrical Steel (US)** | Cleveland-Cliffs Butler Works (US) | Sole domestic producer post-Allegheny exit; every US transformer maker draws from one source | Transformer manufacturing throughput collapses; existing 4-yr lead times extend to 6+ yrs | Cleveland-Cliffs Weirton transformer plant 2026; no alt GOES producer |
| **Large power transformers** | ~80% imported (KR, MX, EU) + Hitachi + Siemens | Domestic capacity meets 20% of demand; 128-week avg lead times; 5-yr for some classes | Data center grid interconnects stall; new generation can't be evacuated | Hitachi VA plant 2028; Siemens NC 2027; structural shortage through 2030 |
| **Heavy rare earths refining (Dy, Tb, Y, Sm)** | China (90–99% share) | Lynas Q1 2026 made 8 tons Dy+Tb vs China's 14 tons/month export to Japan | NdFeB high-temp magnets for EV motors, robotics, wind, defense lose coercivity | <20% non-China supply by 2035 (McKinsey); structural |
| **Light rare earth refining + NdFeB magnets (US)** | MP Materials (US) | Only vertically integrated US producer; Q1 2026 NdPr 917 tons; sole Mountain Pass mine | US-built motors, drones, robotics, defense magnet supply collapses | USA Rare Earth Phase 1a 2026 (600 t/yr); MP 10X facility 2028+ |
| **Rapid thermal processing (RTP/RTA)** | Applied Materials (US) | ASMI exited 2008; Applied dominant in production-scale lamp/laser anneal | All advanced logic anneal steps stall; ion implant activation impossible | No credible second source for leading-edge nodes |
| **EUV-grade rare gases (Ne, Kr, Xe)** | Linde + Air Liquide + Air Products | Tight by-product supply from large ASUs; geographically concentrated (US, DE, JP, RU, UA) | Excimer laser source gases choke; DUV multi-patterning halts | Linde La Porte TX neon; multi-site purification; structurally tight |
| **SiC wafers (200mm/300mm)** | Wolfspeed (US, post-Ch.11) + STMicro + onsemi + Coherent | Wolfspeed emerged Sept 2026; only firm with 300mm SiC demo; Mohawk Valley 200mm consolidated | Power electronics for AI data center 800V DC, EV motor drives stall | Mohawk Valley ramp; Renesas equity stake post-restructuring |
| **CMP slurries (high-purity)** | Entegris (CMC Materials) + Fujifilm + Versum + DuPont | Entegris ~22%, fragmented but few sub-ppb-purity qualified suppliers | Wafer planarization for advanced nodes degrades; yield collapse | Multiple suppliers but multi-quarter requalification |
| **Etch / Deposition tools (oligopoly)** | Applied Materials + Lam Research + Tokyo Electron | Three vendors, deep IP, multi-year qualification | GAA + backside power delivery toolchains stall | No near-term entrant |
| **Helium-3** | DOE Isotope Program / Savannah River (US) + Rosatom (RU) | Byproduct of tritium decay; only ~8,000 L/yr US production; ~90,000 L total stockpile | Quantum dilution refrigerator builds halt; tritium maintenance constrains | Canadian heavy-water reactor extraction first commercial non-mil source; lunar speculative |
| **Skilled construction trades (electricians, HVAC)** | Diffuse but supply-constrained | 499K worker shortfall projected 2026; 41% retiring by 2031; apprentice pipeline 4–5 yrs | Data center commissioning slips 8.5–12 months; $14.2M/mo lost revenue per 60MW site | Siemens 200K by 2030; ABC needs 456K in 2027 alone |
| **Optical fiber cable** | Corning + Prysmian + Sumitomo | Lead times stretched to 12 months; AI buildout draws fiber from telecom | Hyperscale interconnect and backhaul build delays | Capacity expansions 2026–27 |
| **Chinese HVDC + smart transformer tech** | CRRC ecosystem / Changzhou Xidian (CN) | China leads 1100kV UHVDC; US imported $4B Chinese transformers in 2024 | If China embargoes (or US bans imports for security), US grid expansion stalls further | No Western 1100kV UHVDC equivalent; Hitachi/Siemens at lower voltage |
| **Substrate copper-clad laminate (CCL) + T-glass cloth** | Resonac + MGC (JP) | Synchronized price hikes; T-glass supply gap >40% H2 2026 | Substrate yields drop; ABF doesn't matter if T-glass is missing | Multi-year qualification cycles |

## Concentration heat map

**Geographic concentration:**
- **Taiwan**: ~90% of <10nm logic; >85% advanced packaging; Ajinomoto's largest customer is here. Single earthquake or strait incident = global compute reset.
- **South Korea**: ~62% HBM; 50%+ DRAM; SK Hynix the single most valuable AI dependency outside of Nvidia and TSMC.
- **Japan**: 95%+ EUV photoresist; 100% ABF; >50% 300mm silicon wafers; 90%+ actinic mask inspection; substrate CCL duopoly. Often invisible in capex narratives.
- **Netherlands**: 100% EUV scanners. One company.
- **China**: 90% rare earth refining; 99% heavy rare earths; >50% global transformer manufacturing capacity; leading HVDC tech.
- **US**: Sole-source GOES (Cleveland-Cliffs); sole-source Western HALEU (Centrus); only integrated rare-earth mine-to-magnet (MP Materials); RTP (Applied); EML lasers (Lumentum).

**Sectoral concentration of single-firm risk:**
- **One-firm SPOFs** (no substitute inside 12 mo): ASML, Ajinomoto, Centrus, Cleveland-Cliffs GOES, MP Materials (US), Lumentum 200G EML, Lasertec actinic.
- **Two-firm SPOFs**: SK Hynix + Samsung (HBM), JSR + TOK (EUV resist), Shin-Etsu + SUMCO (300mm), Air Liquide + Linde (rare gases), Linde + DOE (helium isotopes).
- **Three-firm oligopolies**: AMAT + Lam + TEL (etch/dep), KLA + Lasertec + AMAT (process control/inspection), Coherent + AXT + JX Metals (InP substrates).

**Time-to-mitigate distribution:**
- **>10 years**: ASML replacement, Ajinomoto ABF replacement (glass substrates), heavy rare earth de-Sinification.
- **5–10 years**: CoWoS alternatives at parity, US transformer self-sufficiency, HBM3e/HBM4 capacity tripling, Western HALEU at SMR-fleet scale.
- **2–5 years**: Lumentum/Coherent 200G EML second-sourcing, Wolfspeed 300mm SiC, electrician/HVAC apprentice pipeline catch-up, helium-3 commercial recovery.
- **<2 years**: HBM4 qualification at Samsung/Micron, EML capacity expansion, 6" InP substrate ramp.

## What this means for the buildout

1. **Hyperscaler capex schedules are fictional in the absence of a SPOF audit.** When OpenAI/Microsoft/Meta announce $80B/year, they implicitly assume Ajinomoto ships ABF, Lumentum ships EMLs, Lasertec ships actinic tools, and Cleveland-Cliffs ships GOES. Any one of those failing has $10B+ schedule consequences.
2. **The geopolitical surface area is small and named.** "Decouple from China" + "China retaliates" lands on ~6 SPOFs above (rare earths, transformers, gallium/germanium, NAND/SSD assembly, and substrate copper-clad laminate).
3. **Bankruptcy is a real vector.** Wolfspeed's Chapter 11 was the warm-up; any single one of the smaller specialty-materials firms above is similarly exposed if pricing or AI demand slips.
4. **The labor SPOF is the slowest to mitigate.** You can't build an electrician in 18 months. The 499K trades shortfall is the binding constraint on data center commissioning regardless of how much capital or chips arrive.
5. **The synthesis frame**: AI compute is rate-limited not by Nvidia, TSMC, or even ASML — it's rate-limited by the *thinnest* of these supply lines, and the SPOF list reveals at least seven candidates for "thinnest."

## Cross-cutting

This node overlaps every supply-side node in the graph. Specifically:
- **mfg** — overlaps on TSMC CoWoS, ASML, EUV resist, AMAT/Lam/KLA, RTP, wafers, ABF, mask inspection.
- **memory** — SK Hynix HBM concentration, HBM4 qualification at Samsung, Micron capacity.
- **supply** — the parent of this node; rare earths, gases, substrates, transformer steel.
- **china** — heavy rare earths, transformer exports, retaliation surface area.
- **utilities** — large power transformers, GOES, HVDC, grid lead times.
- **energy** — HALEU/Centrus for SMRs, transformer steel for grid evacuation.
- **datacenter** — skilled-trades shortfall, transformer lead times, SiC for 800V DC.
- **networking** — Lumentum/Coherent InP EML, optical fiber lead times, transceiver capacity.
- **compute** — CoWoS, HBM, ABF cascade into Nvidia/AMD shipment schedules.
- **siting** — labor shortage and transformer lead times drive site selection.
- **av** — rare-earth magnets and SiC for traction inverters share the same SPOFs.
- **robotics** — NdFeB magnets, heavy rare earths (Dy/Tb) for high-temp actuators.
- **quantum** — helium-3 the binding SPOF for dilution refrigerators at scale.
- **nand-alt** — substrate CCL, ABF cross-apply to memory packaging.
- **inference** — networking and substrate SPOFs gate inference cluster scale.
- **eda** — only loosely coupled (a software SPOF analog — Synopsys/Cadence/Siemens-Mentor oligopoly worth a sibling node).
- **demand** — disruption at any SPOF reprices the entire demand curve via pull-in vs push-out dynamics.
- **models** — model release schedules implicitly depend on training compute being delivered on time, which depends on all the above.

## _new_nodes_suggested

- **K3a — EDA software SPOFs**: Synopsys + Cadence + Siemens EDA effectively three-firm gating function for all chip tapeouts; export-control surface area against China; worth a sibling node to K3.
- **K3b — IP cores SPOFs**: ARM (CPU IP), Synopsys IP, Imagination (GPU IP residual). Single-vendor dependency on the silicon design side.
- **K3c — Chemicals & precursors**: tungsten hexafluoride, hafnium, ruthenium, cobalt CVD precursors — narrow supplier base across Versum, Adeka, Mitsui, Air Products.
- **K3d — Specialty fluorochemicals**: post-PFAS-ban risk; sole-source etch and clean chemistries from Chemours, Daikin, AGC.
- **K3e — Construction & commissioning labor**: deserves its own node given 499K shortfall is the binding rate constraint on data center turn-up.
- **K3f — China retaliation surface area**: dedicated node mapping the ~6 SPOFs where China holds the leverage (heavy REE, gallium, germanium, antimony, graphite, transformer exports).
- **K3g — Insurance / reinsurance for AI factories**: fast-emerging SPOF as Lloyd's-led market reprices Taiwan + Korea concentration risk.
- **K3h — Bankruptcy contagion vector**: Wolfspeed as case study; any of the smaller specialty firms could trigger a cascade — worth tracking as a category.

## Sources

- [The Great Packaging Pivot: TSMC CoWoS Capacity Through 2026](https://markets.financialcontent.com/wral/article/tokenring-2026-1-1-the-great-packaging-pivot-how-tsmc-is-doubling-cowos-capacity-to-break-the-ai-supply-bottleneck-through-2026)
- [Who Will Divide Up the CoWoS Production Capacity in 2026?](https://eu.36kr.com/en/p/3580962946874242)
- [Intel challenges TSMC CoWoS as Amazon, Google reportedly explore alternatives (Digitimes)](https://www.digitimes.com/news/a20260407VL205/cowos-packaging-intel-demand-tsmc.html)
- [SK Hynix Holds 62% of HBM, Micron Overtakes Samsung — 2026 Battle Pivots to HBM4](https://www.astutegroup.com/news/general/sk-hynix-holds-62-of-hbm-micron-overtakes-samsung-2026-battle-pivots-to-hbm4/)
- [SK Hynix Reportedly to Supply About Two-Thirds of NVIDIA HBM4 (TrendForce)](https://www.trendforce.com/news/2026/01/28/news-sk-hynix-reportedly-to-supply-about-two-thirds-of-nvidia-hbm4-samsung-targets-early-delivery/)
- [2026 Market Outlook: SK Hynix HBM-led Memory Supercycle](https://news.skhynix.com/2026-market-outlook-focus-on-the-hbm-led-memory-supercycle/)
- [The ASML Monopoly: How One Dutch Company Controls Every Advanced Chip](https://www.mindremix.com/2026/01/asml-monopoly-euv-lithography-semiconductor-future-2026.html)
- [ASML and the High-NA EUV Monopoly: The Path to 1.4nm](https://www.financialcontent.com/article/tokenring-2026-2-2-asml-and-the-high-na-euv-monopoly-the-path-to-14nm)
- [Monopoly No More? ASML May Suddenly Have a New Competitor (xLight)](https://247wallst.com/investing/2025/12/02/monopoly-no-more-asml-may-suddenly-have-a-new-competitor/)
- [Wolfspeed 8-K Q3 FY2026 — Chapter 11 emergence and SiC consolidation](https://www.sec.gov/Archives/edgar/data/0000895419/000089541926000024/ex991q3-26.htm)
- [Wolfspeed Q2 FY2026 — Renesas equity, 300mm SiC demo](https://www.sec.gov/Archives/edgar/data/0000895419/000089541926000012/ex991q2-26.htm)
- [Centrus Energy 900-kg HALEU Delivery Milestone (POWER)](https://www.powermag.com/centrus-completes-900-kg-haleu-delivery-to-doe-in-u-s-nuclear-fuel-enrichment-milestone/)
- [Centrus DOE Contract Extension — HALEU Phase III](https://www.centrusenergy.com/news/centrus-energy-secures-contract-extension-from-department-of-energy-to-continue-haleu-production/)
- [US invests $2.7B to end Russia's monopoly on advanced nuclear fuel](https://www.naturalnews.com/2026-01-08-us-invests-to-end-russian-monopoly-nuclear-fuel.html)
- [Cleveland-Cliffs Weirton Transformer Plant $150M Investment](https://www.manufacturingdive.com/news/cleveland-cliffs-confirms-150-million-electric-transformer-weirton-plant/722787/)
- [The Iron Fortress: Cleveland-Cliffs and the High-Stakes Future of American Steel](https://markets.financialcontent.com/wral/article/finterra-2026-2-16-the-iron-fortress-cleveland-cliffs-and-the-high-stakes-future-of-american-steel)
- [Japanese Companies Monopolize the EUV Photoresist Supply Market](https://www.fountyltech.com/news/japanese-companies-monopolize-the-euv-photoresist-supply-market/)
- [Japan Ramps Up Photoresist Investment for 2nm — TOK, JSR Lead the Charge](https://www.trendforce.com/news/2025/11/06/news-japan-ramps-up-photoresist-investment-for-2nm-chips-tokyo-ohka-kogyo-jsr-lead-the-charge/)
- [JSR Builds First Taiwan Photoresist Plant Near TSMC (Tom's Hardware)](https://www.tomshardware.com/tech-industry/jsr-builds-first-taiwan-photoresist-plant-as-japanese-materials-makers-race-to-embed-next-to-tsmc)
- [Lumentum's 2028 Vision: Inside the $30 EPS Target and the NVIDIA-Powered Optical Revolution](https://www.financialcontent.com/article/marketminute-2026-3-30-lumentums-vision-for-2028-inside-the-30-eps-target-and-the-nvidia-powered-optical-revolution)
- [AI Data Center Optical Component Shortage: Nvidia's $4B Laser Lockup (TechTimes)](https://www.techtimes.com/articles/317281/20260527/ai-data-center-optical-component-shortage-nvidias-4b-laser-lockup-pushes-rivals-past-2027.htm)
- [NVIDIA's $4B Photonics Play: Lumentum vs Coherent (Tech-Insider)](https://tech-insider.org/nvidia-silicon-photonics-lumentum-coherent-ai-data-center-2026/)
- [NVIDIA's $4B Optics Bet Signals Photonics as AI's Next Bottleneck (Futurum)](https://futurumgroup.com/insights/nvidias-4b-optics-bet-signals-photonics-as-ais-next-bottleneck/)
- [MP Materials Q1 2026 Results — Record NdPr Production](https://rare-earth-mining.com/mp-materials/)
- [The Only Fully Integrated US Rare Earth Producer (Motley Fool, May 2026)](https://www.fool.com/investing/2026/05/06/the-only-fully-integrated-us-rare-earth-producer-h/)
- [Heavy Rare Earth Elements: Rising Supply Chain Risks (Covington Global Policy Watch)](https://www.globalpolicywatch.com/2026/02/heavy-rare-earth-elements-rising-supply-chain-risks-and-emerging-policy-responses/)
- [China Rare Earth Export Controls — April Curbs Still Bite (TechTimes, May 2026)](https://www.techtimes.com/articles/317208/20260526/china-rare-earth-export-controls-april-curbs-still-bite-after-beijing-summit.htm)
- [Consequences of China's New Rare Earths Export Restrictions (CSIS)](https://www.csis.org/analysis/consequences-chinas-new-rare-earths-export-restrictions)
- [Ajinomoto Controls 95% of ABF Film Market — Hikes Prices 30%](https://finance.biggo.com/news/ZU2KJZ4BpwxG186NIOsE)
- [Ajinomoto Boosts Chip Materials Business with ¥1.2B Land Buy for 2032 Plant (TrendForce)](https://www.trendforce.com/news/2026/05/08/news-ajinomoto-ramps-chip-packaging-push-with-%C2%A51-2b-land-buy-for-new-plant-in-2032-abf-margins-top-50-on-ai-boom/)
- [How an MSG Factory Holds Nvidia by the Throat — ABF Material](https://www.tradingkey.com/analysis/stocks/us-stocks/261783966-abf-ajinomoto-nvidia-ai-supply-chain-tradingkey)
- [Finding Defects in EUV Masks (Semiconductor Engineering)](https://semiengineering.com/finding-defects-in-euv-masks/)
- [Lasertec — Actinic EUV Mask Inspection Near-Monopoly](https://www.jaredwatkins.com/research/semiconductors/fabrication-equipment/lasertec/)
- [EUV Mask Inspection Market Share 2035 (Global Market Insights)](https://www.gminsights.com/industry-analysis/euv-mask-inspection-market)
- [Top 10 Companies in the Indium Phosphide Industry 2026](https://chemicalresearchinsight.com/2026/03/27/top-10-companies-in-the-indium-phosphide-industry-2026-driving-the-future-of-high-speed-electronics-and-photonics/)
- [Coherent's Vertical Integration Strategy (Chipstrat)](https://www.chipstrat.com/p/coherents-vertical-integration-strategy)
- [US Transformer Market Faces Severe Supply Constraints — 4-Year Lead Times (PV Magazine May 2026)](https://pv-magazine-usa.com/2026/05/11/u-s-transformer-market-faces-severe-supply-constraints-as-lead-times-extend-to-four-years/)
- [Transformers in 2026: Shortage, Scramble, or Self-Inflicted Crisis? (Power Magazine)](https://www.powermag.com/transformers-in-2026-shortage-scramble-or-self-inflicted-crisis/)
- [Data Center Construction Labor Report — 499K Worker Shortage](https://www.irecruit.co/insights/data-center-construction-labor-market-report)
- [AI Data Center Boom Creating Dire Electrician Shortage (Fortune, March 2026)](https://fortune.com/2026/03/02/ai-data-centers-electrician-shortage-gen-z-training-careers/)
- [As Helium-3 Runs Scarce, Researchers Seek New Ways to Chill Quantum Computers (Science/AAAS)](https://www.science.org/content/article/helium-3-runs-scarce-researchers-seek-new-ways-chill-quantum-computers)
- [Caught by Surprise: Helium-3 Supply Crisis (House Science Committee)](https://democrats-science.house.gov/hearings/caught-by-surprise-causes-and-consequences-of-the-helium-3-supply-crisis)
- [Helium Shortage & Semiconductor Supply Chain Crisis 2026](https://www.kunalganglani.com/blog/helium-shortage-semiconductor-supply-chain)
- [Top 5 Silicon Wafer Manufacturing Companies in 2026](https://waferpro.com/top-5-silicon-wafer-manufacturing-companies/)
- [Semiconductor Silicon Wafer Market Outlook 2026-2033](https://semiconductorinsight.com/report/semiconductor-silicon-wafer-market/)
- [Linde Rare Gas Production Capabilities](https://www.linde-gas.com/whats-happening/article-folder/rare-gas-production)
- [Air Liquide Krypton for High-Precision Photolithography](https://advancedtech.airliquide.com/krypton)
- [Applied Materials Q2 FY2026 Earnings (8-K)](https://www.sec.gov/Archives/edgar/data/0000006951/000162828026035071/exhibit991q22026earningsre.htm)
- [Applied Materials Rapid Thermal Processing Product Page](https://www.appliedmaterials.com/us/en/semiconductor/products/processes/rapid-thermal-processing-treatments.html)
- [US AI Can't Do Without Chinese Transformers (36Kr)](https://eu.36kr.com/en/p/3650249701274372)
- [Installed Chinese-made Transformers Can Impact the Grid Today (Control Global)](https://www.controlglobal.com/home/blog/11293192/information-technology)
- [Entegris Q1 2026 Earnings (8-K)](https://www.sec.gov/Archives/edgar/data/0001101302/000110130226000099/entgq12026ex991.htm)
- [Silicon Wafer CMP Slurry Market Size and Share](https://www.businessresearchinsights.com/market-reports/silicon-wafer-cmp-slurry-market-107923)

---

## Kioxia + Solidigm — alternative NAND

## Current state (May 2026)

**Kioxia (TYO: 285A / OTC: KXIAY)** — world's #3 NAND vendor at ~15.6% share in Q4 2025 (TrendForce). Listed on Tokyo Stock Exchange Dec 18, 2024 at a ~$5.2B valuation; market cap has since exploded to ~¥26.5T (~$170-215B as of May 2026), up roughly 2,400-2,966% in one year as AI-driven NAND demand re-rated the stock. A US (NASDAQ) cross-listing is in the works (Blocks & Files, May 2026). Bain Capital led the 2018 buyout from Toshiba; Toshiba still holds ~21.9% as of Nov 2025.

- **FY2026 results** (year ending March 2026): revenue ¥2.34T (~$14.7B, +37% YoY); net profit ¥554.5B; SSD & Storage segment ¥1.36T.
- **Q4 FY2026** (Jan-Mar 2026): revenue ¥1.003T (~$6.29B, +84.5% QoQ); net income ¥407.7B; SSD segment ¥600.3B alone.
- **Q1 FY2027 guidance** (Apr-Jun 2026): net profit ¥869B — a 48-fold YoY surge — with operating profit guidance of ¥1.298T.
- **All 2026 NAND volume already sold out**, per managing director Shunsuke Nakato; tightness expected to persist through 2027.
- **122TB and 245TB SSDs** shipped for qualification end-2025; mass production starting 2026.
- **SanDisk JV not unwinding** — opposite: on Jan 29, 2026 the Yokkaichi (and Kitakami) Flash Ventures JV was extended through Dec 31, 2034. Sandisk pays Kioxia $1.165B 2026-2029 for manufacturing services. Kioxia owns 51% of Flash Ventures.
- **Capex**: Kioxia/Sandisk consortium $4.5B in 2026 (+41% YoY) — most aggressive in the industry. BiCS10 (332-layer) production pulled forward from 2H27 to 2026 at the new Kitakami K2 fab (opened Sept 2025; repurposed rather than greenfield to save capex). BiCS10 = ~59% higher bit density than BiCS8, 4.8 Gbps interface, targeted at enterprise SSD.
- **HBF**: Kioxia partnered with Nvidia on SSDs ~100× faster than current drives for 2027, positioned to displace HBM in inference. (Distinct from the SanDisk + SK Hynix HBF standard.)

**Solidigm** — SK Hynix's wholly-owned US NAND/SSD subsidiary, formed Dec 2021 from a $7B acquisition of Intel's NAND + Dalian fab business. Branded under "SK hynix NAND Product Solutions Corp d/b/a Solidigm". Headquartered in San Jose, CA. No HBM business (only NAND/SSD).

- **Enterprise SSD leadership**: SK Group (SK Hynix + Solidigm) hit 30.2% enterprise SSD share in Q4 2025 (up from 26.8% in Q3), overtaking Samsung in that segment. Combined NAND share 22.1% in Q4 2025 ($5.21B revenue, +47.8% QoQ).
- **Financials**: H1 2025 revenue ₩3.36T (~$2.4B), operating profit ₩132B (swing from prior loss). 2024 sales ~₩9.3T (~$6.7B); 2026 forecast ~₩11.8T (~$8.5B) with ₩1.4T net profit.
- **Product**: D5-P5336 122TB QLC SSD shipping (192-layer QLC, PCIe 4.0); D7-PS1010/PS1030 PCIe Gen5 ramping (industry's first liquid-cooled enterprise SSD, E1.S form factor, qualified for Nvidia HGX B300). 245TB QLC drive confirmed to launch before end of 2026.
- **MLPerf**: D7-PS1010 cluster achieved 116 GB/s per-node throughput — highest measured in AI training storage tests.
- **IPO/sale uncertainty**: Talk of a US Solidigm IPO has been put on hold; Chosun Biz reports SK Group is weighing divestment strategies (Nov 2025 TrendForce).

## Strategic position

If SanDisk + WDC are sold out for 2026 (M4), the two largest spillover destinations are Kioxia and Solidigm — but every NAND maker is also sold out, so "alternative supply" is more about relative allocation flexibility than spare capacity.

- **Kioxia is the most exposed pure-play to NAND tightness**: no DRAM cushion (unlike Samsung, SK Hynix, Micron), 100% of upside flows through NAND. That's why its profit print is jumping 48× YoY while DRAM-heavy peers see smaller multiples. Q1 FY27 guide of ¥1.3T operating profit on ~$7B+ quarterly revenue is roughly an 18-month-ago full-year P&L.
- **Solidigm holds the QLC/high-capacity AI inference niche**: 122TB drive already shipping, 245TB by year-end 2026 — the densest in the market. AI inference (read-heavy, capacity-bound) favors QLC, and Solidigm's portfolio is positioned around exactly this.
- **HBF risk shifts demand toward Sandisk + SK Hynix axis**, not Kioxia/Solidigm directly. But Kioxia's parallel Nvidia-partnered fast-SSD-vs-HBM play is a competing standard — a node fork worth tracking.
- **Pricing**: NAND contract prices projected +70-75% QoQ in Q2 2026 (outpacing DRAM for the first time this cycle); spot prices already +90% in Q1 2026. Margin expansion is dramatic for both.

## Capacity reality check

- **Kioxia 2026 NAND output: SOLD OUT** (confirmed by Kioxia exec to Digital Daily, Feb 2026; corroborated by Phison CEO industry-wide).
- **Solidigm/SK Hynix 2026 NAND: SOLD OUT** (SK Hynix sold out DRAM, NAND, and HBM into 2026 — TechSpot).
- **New supply lead time**: New fab lines not online in volume before late 2027 / 2028. Phison projects "pricing apocalypse" through 2027.
- **Kioxia capex $4.5B (FY26) is most aggressive**, but it's a fab repurpose (K2) not greenfield — modest bit growth, not a step-change in 2026 supply.
- **Aggregate NAND industry share**: Samsung 28.0% + SK Hynix/Solidigm 22.1% + Kioxia 15.6% + Sandisk ~13% + Micron ~10-13% = top 5 ~89% of the market.
- **Net answer to user's question**: Kioxia + Solidigm can't "absorb" Sandisk/WDC spillover in 2026 — they're allocation-bound too. They CAN reallocate at the margin (Micron's Crucial exit Feb 2026 frees a small slug of bits) but the structural answer is that 2026 demand exceeds total industry supply. Hyperscalers signing multi-quarter take-or-pay deals to lock allocations.
- **2027 picture**: BiCS10 ramp (Kioxia) + 321-layer QLC ramp (SK Hynix HQ) + Solidigm 245TB drive give some relief, but Phison's late-2027 timeline for new lines is the binding constraint.

## Risks

- **Kioxia overheating**: 25-30× P/E expansion in 18 months; any inference slowdown crushes the stock. Pure-play NAND is the highest-beta way to express AI memory demand.
- **Solidigm divestment**: SK Group sale rumors create supply chain uncertainty for hyperscalers that have qualified Solidigm parts. A change of control could disrupt 2027 capacity commitments.
- **BiCS10 yield risk**: 332-layer NAND with deep-trench etching is unproven at volume. K2 ramp delay would tighten 2027 further.
- **Sandisk JV dependency**: Kioxia and Sandisk share Flash Ventures (51/49) through 2034. If Sandisk's HBF business pulls capacity allocation toward HBF wafers, Kioxia's conventional SSD output could be constrained — but Kioxia controls majority of the JV, so this risk runs in Sandisk's direction more than Kioxia's.
- **Yen exposure**: Kioxia reports in JPY; JPY strength would compress reported earnings even if dollar pricing holds.
- **HBF cannibalization timing**: If HBF or Kioxia's Nvidia-partnered SSD-as-HBM replacement ramps faster than expected in 2027, conventional enterprise SSD ASPs may not stay this elevated.
- **Micron pivot**: Crucial shutdown by Feb 2026 means Micron's bit output is fully redirected to enterprise NAND + HBM, partially relieving the tightness Kioxia/Solidigm are profiting from. Micron 9650 (first PCIe Gen6 datacenter SSD) is a direct competitor at the leading edge.

## Cross-cutting

- **M1 (SK Hynix)**: Solidigm IS SK Hynix's NAND/SSD subsidiary — the SK Group enterprise SSD lead (30.2% Q4 2025) is the combined SKH + Solidigm number. M1 and M6 partially overlap; consider whether Solidigm should be a sub-node of M1 instead of a standalone M6 entry. Counter-argument: Solidigm is operationally separate (San Jose HQ, Dalian fab, Intel heritage, different product roadmap) and the divestment rumor makes the relationship potentially temporary.
- **M3 (Samsung)**: Samsung remains #1 NAND at 28.0% but is being out-grown by SK Hynix/Solidigm (+47.8% QoQ) and Kioxia (+33.1% QoQ in Q3 2025). Samsung's enterprise SSD share is actively losing to the SK Group.
- **M4 (Sandisk + WDC)**: Kioxia and Sandisk co-own Flash Ventures (Kioxia 51%, Sandisk 49%) through Dec 31, 2034 — they are joint-at-the-fab. Sandisk's HBF strategy is a Sandisk + SK Hynix initiative, but the wafers come from a Kioxia-controlled JV. This means an M4 / M6 capacity allocation conflict is structurally possible.
- **Inference compute nodes**: Solidigm's MLPerf storage leadership (116 GB/s/node) directly affects training/inference cluster economics — relevant to GPU cluster sizing nodes.
- **Power**: 122TB QLC drives deliver ~3.4× more TB/watt than 30TB TLC competitors — a material consideration for datacenter power-constrained sites.

## Sources

- [Kioxia rides the AI wave to record revenues and a US listing — Blocks & Files (May 21, 2026)](https://www.blocksandfiles.com/flash/2026/05/21/kioxia-rides-the-ai-wave-to-record-revenues-and-a-us-listing/5241267)
- [Kioxia Posts Record ¥543.6B Q3 FY25 Revenue, Confirms 2026 NAND Fully Booked — TrendForce (Feb 13, 2026)](https://www.trendforce.com/news/2026/02/13/news-kioxia-posts-record-%C2%A5543-6b-q3-fy25-revenue-confirms-2026-nand-fully-booked/)
- [Kioxia Forecasts 48-Fold Surge in Q1 Net Profit to ¥869 Billion — BigGo Finance](https://finance.biggo.com/news/fAuiKp4BaoGGrU-IuddK)
- [Kioxia IPO sets market value at $5.2B — Japan Times (Dec 2024)](https://www.japantimes.co.jp/business/2024/12/09/companies/kioxia-ipo-high/)
- [Kioxia shares rally after IPO that valued Bain-owned chipmaker at $5B — Fortune](https://fortune.com/asia/2024/12/17/kioxia-shares-ipo-toshiba-bain-capital-japan-chips/)
- [Kioxia and Sandisk Extend Yokkaichi JV Through 2034 — Kioxia press release (Jan 30, 2026)](https://www.kioxia.com/en-jp/about/news/2026/20260130-1.html)
- [Kioxia and Sandisk Extend Yokkaichi JV Through 2034 — Sandisk press release (Jan 29, 2026)](https://www.sandisk.com/company/newsroom/press-releases/2026/2026-01-29-kioxia-and-sandisk-extend-yokkaichi-joint-venture-agreement-through-2034)
- [Kioxia's next-gen 3D NAND production expedited to 2026 (BiCS10) — Tom's Hardware](https://www.tomshardware.com/pc-components/ssds/kioxias-next-gen-3d-nand-production-gets-expedited-to-2026-report-claims-high-capacity-332-layer-bics10-devices-to-sate-growing-demand-from-ai-data-centers)
- [Kioxia NAND Mass Production Accelerates: BiCS10 — TechTimes (May 24, 2026)](https://www.techtimes.com/articles/317071/20260524/kioxia-nand-flash-mass-production-accelerates-bics10-target-puts-samsung-sk-hynix-edge.htm)
- [Kioxia Reportedly to Make 332-Layer 10th-Gen NAND at Kitakami in 2026 — TrendForce](https://www.trendforce.com/news/2025/12/12/news-kioxia-reportedly-to-make-332-layer-10th-gen-nand-at-kitakami-in-2026-repurposing-existing-fab/)
- [Kioxia Holdings market cap (TYO:285A) — Stock Analysis (May 26, 2026)](https://stockanalysis.com/quote/tyo/285A/market-cap/)
- [NAND flash supply for 2026 already sold out, says Kioxia exec — Yahoo Finance](https://finance.yahoo.com/news/nand-flash-supply-2026-already-130253516.html)
- [Phison CEO confirms all 2026 NAND production sold out — Tom's Hardware](https://www.tomshardware.com/pc-components/ssds/phison-ceo-confirms-nand-prices-have-more-than-doubled-and-will-continue-to-rise-all-2026-production-already-sold-out-ssds-facing-pricing-apocalypse-throughout-2027)
- [SK Hynix sells out DRAM, NAND, and HBM capacity into 2026 — TechSpot](https://www.techspot.com/news/110058-sk-hynix-completely-sells-out-semiconductor-supply-ai.html)
- [SK hynix Q1 2026 Financial Results — SK Hynix newsroom](https://news.skhynix.com/q1-2026-business-results/)
- [SK hynix's Solidigm roars back on AI storage demand — completeaitraining.com](https://completeaitraining.com/news/sk-hynixs-solidigm-roars-back-on-ai-storage-demand-with/)
- [SK hynix Eyes 321-Layer QLC NAND in 2H26; Solidigm IPO Uncertain — TrendForce (Nov 11, 2025)](https://www.trendforce.com/news/2025/11/11/news-sk-hynix-reportedly-eyes-321-layer-qlc-nand-in-2h26-future-of-solidigm-ipo-uncertain/)
- [Solidigm D7-PS1010 PCIe 5.0 NVMe SSD product page](https://www.solidigm.com/products/data-center/d7/ps1010.html)
- [Solidigm 122TB D5-P5336 announcement — Solidigm newsroom](https://news.solidigm.com/en-WW/243441-solidigm-extends-ai-portfolio-leadership-with-the-introduction-of-122tb-drive-the-worlds-highest-capacity-pcie-ssd/)
- [Solidigm liquid-cooled enterprise SSD — Tom's Hardware](https://www.tomshardware.com/pc-components/ssds/solidigm-touts-industrys-first-liquid-cooled-enterprise-ssd-d7-ps1010-is-an-e-1-pcie-5-0-drive-with-a-wrap-around-cold-plate)
- [Solidigm 245TB SSDs to launch before end of 2026 — TechRadar](https://www.techradar.com/pro/solidigm-confirms-245-tb-ssds-set-to-launch-before-end-of-2026)
- [Second-Tier No More: Kioxia and SanDisk Balance Alliance and Rivalry in AI NAND Race — TrendForce (Jan 29, 2026)](https://www.trendforce.com/news/2026/01/29/news-second-tier-no-more-kioxia-and-sandisk-balance-alliance-and-rivalry-in-ai-nand-race/)
- [AI Infrastructure Strengthens NAND Flash Demand; Kioxia Posts 33.1% QoQ Growth in 3Q25 — TrendForce (Dec 3, 2025)](https://www.trendforce.com/presscenter/news/20251203-12813.html)
- [NAND Market Surges on AI Server Boom — BigGo Finance](https://finance.biggo.com/news/PlfbtZwBq7sy_YQMJYYc)
- [Micron Announces Exit from Crucial Consumer Business — Micron IR](https://investors.micron.com/news-releases/news-release-details/micron-announces-exit-crucial-consumer-business)
- [Micron to End Crucial Consumer Memory by Feb 2026 — TrendForce](https://www.trendforce.com/news/2025/12/04/news-micron-to-end-crucial-consumer-memory-by-feb-2026-redirects-supply-to-enterprise-amid-ai-surge/)
- [Memory & NAND Flash Crisis: May 2026 Update — NAND Research](https://nand-research.com/memory-nand-flash-crisis-may-2026-update/)
- [Memory Industry to Maintain Cautious CapEx in 2026 — TrendForce (Nov 13, 2025)](https://www.trendforce.com/presscenter/news/20251113-12780.html)

_new_nodes_suggested:
- **M7 — HBF (High Bandwidth Flash) standard**: Sandisk + SK Hynix HBF vs Kioxia + Nvidia fast-SSD-as-HBM-replacement — competing standards for AI inference memory hierarchy.
- **M8 — Flash Ventures JV (Yokkaichi/Kitakami)**: The structural shared-fab dependency between Kioxia and Sandisk; this is the actual physical capacity, distinct from the corporate entities. Extended through 2034.
- **M9 — Micron NAND/HBM pivot**: Crucial exit Feb 2026, 9650 PCIe Gen6, redirecting all bits to HBM + enterprise NAND.
- **M10 — Solidigm divestment watch**: Standalone node tracking SK Group sale/IPO decision — affects 30%+ of enterprise SSD supply allocation.

---

## AI server ODMs — Foxconn, Quanta, Wiwynn

## Current state (May 2026)

The ODMs (not the brand-name OEMs) are the real factories behind every GB200/GB300 NVL72 rack shipping to Microsoft, Meta, Google, AWS, Oracle, Dell, SMCI, and HPE. Each rack sells for ~$2-3M (vs ~$800 for an assembled iPhone), and Morgan Stanley estimates 70-80k Blackwell racks ship in 2026 vs ~29k in 2025. The market has re-rated these names hard, but with wide dispersion based on Blackwell allocation, customer mix, and margin.

**Foxconn / Hon Hai (2317.TW)** — The 800-lb gorilla. >40% global AI-server market share, Nvidia's largest contract manufacturer for racks. Q1 FY26 revenue +29.7% YoY; full-year 2025 revenue NT$8.10T (+18.1%), net profit NT$189.3B (+24%), EPS NT$13.61 (record). Chairman Young Liu has guided 2026 revenue >NT$9T (~$280B). Cloud & networking surpassed smart-consumer-electronics revenue for the first time. Stock NT$259, market cap ~$129B USD (May 2026); 52-wk range NT$151-265, so ~+70% off the low but pulled back ~10% from the late-Feb peak on Middle East risk and a North America cyberattack (May 12). Mexico Tonala/Guadalajara gigafactory ($900M, online 2026) targets the world's largest GB200 plant for OpenAI/Oracle Stargate; Houston ramping to ~2,000 racks/week (Q1 2026 GB300 start, includes humanoid-robot pilot). JP Morgan calls it the single biggest beneficiary of GB200 NVL72 + Vera Rubin cycles.

**Quanta Computer (2382.TW)** — The pure-play AI ODM. Q1 FY26 revenue NT$809.2B (+66.6% YoY, +66.7% QoQ, single-quarter record). AI-server share of total server revenue now >75%, with GB300 racks (>$3M ASP) now outshipping GB200 — but gross margin compressed -154 bps QoQ to 4.78% as high-ASP mix dilutes margin %. Net profit NT$21.19B, EPS NT$5.50 (record). CFO Elton Yang held triple-digit AI-server growth guidance; raised general-server outlook to double-digit. Stock NT$339 (May 29, +9.89% on the day), market cap ~NT$1.22T (~$40B USD). 1-yr return ~+20%, 52-wk range NT$252.50-352.50; ATH NT$352.50 hit May 7. Forward PE 12.77, ROE 36.8% — arguably the most undervalued of the top 3 on PE/growth despite great fundamentals; the perception is "margin compression" obscures massive absolute-profit growth. Builds GB200/GB300 for Google, AWS, Meta; B200 for Microsoft.

**Wiwynn (6669.TW)** — The breakout name; >50% of revenue from Meta, large Microsoft exposure. 2025 revenue NT$950.66B (+163.7% YoY). Stock NT$4,950 (May 28); 1-yr return ~+124-144% depending on source, 52-wk range NT$2,360-5,880, ATH NT$5,045 (Apr 27, 2026 — though prints up to ~5,880 cited). Market cap ~NT$1.0T (~$33B USD). EBITDA margin 7.0% — structurally higher than Quanta because of pure hyperscaler ODM-Direct model (no laptop drag, no brand layer). Analyst 12-mo PT NT$6,681 (+26.5%), Strong Buy consensus. Risk: ~95% of A/R concentrated in 3 customers (Meta, MSFT, +1).

**Inventec (2356.TW)** — Quiet outperformer. Q1 FY26 revenue NT$200.3B (+27.6% YoY, record), server >50% of revenue for the first time. AI servers running mostly Nvidia B200 HGX, plus AMD MI300/MI355X and ASIC; notably ~50% of AI-server revenue comes from Chinese customers — geopolitical wildcard. Rumored Google TPU L10/L11 server-assembly orders. Stock jumped 8.42% on May 13 on record profit + bullish guidance, defying a 500-pt TAIEX drop. Texas L10/L11 lines live; Mexico + Thailand expanding. Plays the non-Nvidia AI lane harder than its peers.

**Pegatron (4938.TW)** — The laggard pivoting. 2024 revenue declined -10.5%; trailing 12-mo ~$35.8B. Stock down ~24.5% over 1 yr (as of Jan 2026), market cap ~NT$205B (~$6.5B USD). Divested 60% of India iPhone plant to Tata. New Texas AI-server plant trial production H1 2026; management guiding triple-digit ("tenfold") AI-server growth in 2026 off a low base (May 28 shareholder meeting). Bid for AMD/ZT Systems plants but dropped out. Dividend yield ~5.2%.

**Compal (2324.TW)** — Catching up. 2025 revenue $23.7B (down from $38.4B in 2021). $500M Texas AI plant targets H2 2026 mass production; Dell cited as a likely brand client. Showcased HGX Rubin NVL8 (8 Rubin GPUs in 2U, 400 PFLOPS NVFP4, ~24kW liquid-cooled) at GTC 2026. Still bidding on AMD/ZT plants alongside Wiwynn and Jabil. Chairman Ray Chen wants to "return to trillion-dollar revenue ASAP."

**MiTAC Holdings (3706.TW)** — Server brand consolidator (TYAN folded into MiTAC Oct 2024). 2025 revenue NT$105.6B (~$3.3B USD); 2026 guidance NT$163.9B (+55%). Two California liquid-cooled rack plants — pilot late 2025, mass production Q1 2026; Hanoi factory opening. Showcased MR1100 48U liquid-cooled rack at CloudFest 2026 (AMD MI355X up to 256 GPUs/rack) and MGX/RTX PRO solutions at GTC 2026. Small-cap, more diversified across AMD + Intel + NVIDIA than peers.

**Inspur (China)** — World's #2 AI-server maker by units. On US Entity List since 2023; March 2025 BIS expansion added 6 more subsidiaries including Inspur Taiwan, Inspur Software, Henan Dingxin, Nettrix, Suma Technology, and Suma-USI Electronics — closing the loophole that previously let US companies sell to subs. Cited by BIS for supporting PLA supercomputer projects. HPE has a separate active IP/sanctions-violation suit. Effectively cut off from Nvidia/Intel/AMD top-bin parts; pushed toward Huawei Ascend, Cambricon, Moore Threads. Listed shares (Inspur Electronic Information / Inspur Software / Inspur Digital Enterprise) all repriced lower after each round.

## Who builds for whom

| Customer | Primary ODM(s) | Notes |
|---|---|---|
| **NVIDIA (DGX, reference NVL72)** | Foxconn (primary), Quanta, Wistron | Foxconn does ref design + integration; Quanta on HGX |
| **Microsoft Azure** | Wiwynn (largest), Foxconn, Quanta (B200) | Wiwynn ODM-Direct, dominant on MSFT custom racks |
| **Meta** | Wiwynn (>50% of Wiwynn revenue), Quanta (~50% of Meta orders per TrendForce) | Two-source policy; both win |
| **Google Cloud** | Quanta (GB200), Foxconn, Inventec (TPU rumored) | Inventec the dark horse on TPU L10/L11 |
| **AWS** | Quanta (GB200), Foxconn | Multi-source |
| **Oracle / OpenAI Stargate** | Foxconn (Mexico) | Abilene TX site = 64k GB200 by 2026, first phase 16k this summer |
| **Dell (PowerEdge XE9712/9680)** | Foxconn, Wistron, Compal (incoming) | Dell designs, ODMs build; Compal entering via Dell |
| **SMCI** | Largely in-house (San Jose, Malaysia) + Ablecom, Compuware | SMCI is the outlier — vertically integrated rack builder |
| **HPE** | Foxconn, Inventec, MiTAC | HPE less ODM-dependent post-Cray |
| **AMD MI300/MI355X systems** | Inventec, MiTAC, Pegatron, Compal, Wiwynn | AMD/ZT plant divestment bids: Compal, Wiwynn, Jabil |
| **Chinese hyperscalers (Alibaba, Tencent, Baidu, ByteDance)** | Inspur (sanctioned), H3C, Lenovo, Sugon | Forced onto Huawei Ascend post-sanctions |

## Who's gold, who's silver, who's lagged

- **Gold (best Blackwell/Rubin allocation):** Foxconn — sheer scale, Nvidia ref-design partner, Mexico Stargate exclusivity, 40%+ market share. Highest absolute $ beneficiary.
- **Gold (highest-margin AI-pure):** Wiwynn — 7% EBITDA margin vs Quanta 4.8%, lean ODM-Direct, but priced for it (already ~+140% 1-yr).
- **Silver / most undervalued vs growth:** Quanta — 12.7x fwd PE, 36.8% ROE, AI mix already 75%, GB300 outshipping GB200, but stock only +20% 1-yr because the market frets margin %. Best risk/reward on the leaders.
- **Silver dark horse:** Inventec — Google TPU rumored, AMD + ASIC diversification, 50% China AI exposure (both tail risk and option value if rules ease).
- **Lagged / catch-up trades:** Pegatron (-24% 1-yr, guiding 10x AI growth off tiny base, Texas plant H1 2026), Compal (Dell partnership + $500M Texas plant H2 2026), MiTAC (small-cap, +55% guided 2026 revenue growth, California liquid-cool ramp).
- **Avoid / blacklisted:** Inspur — Entity List + subsidiary loophole closed; structurally cut off from Blackwell/Rubin supply chain.

## Lagged / undervalued comparables

- **Quanta (2382)** is the cleanest "buy the leader at a discount" — AI-pure, GB300 already #1 SKU, fwd PE 12.8x, analyst PT +24-34%. Margin compression is mechanical (high-ASP racks denominator-bloat), not structural.
- **Pegatron (4938)** and **Compal (2324)** are the explicit "catch-up" plays: both have brand-new Texas AI plants coming online in 2026, both started from low AI-server bases, both have explicit guidance that AI-server revenue will multiply this year. Pegatron also yields 5.2% while you wait.
- **MiTAC (3706)** small-cap optionality: TYAN consolidation, US liquid-cooled rack plants, AMD + Nvidia + Intel diversification, +55% 2026 revenue guide.
- **Foxconn Industrial Internet (FII, 601138.SH)** — the Shanghai-listed Foxconn AI/cloud subsidiary; often a better pure-play vehicle than 2317 since 2317 still carries iPhone drag.

## Risks

- **Hyperscaler capex pause.** MSFT CFO Hood already telegraphed shift from long-lived assets (buildings) to short-lived (chips/hardware) — bullish for ODMs near-term but a leading indicator of any spending plateau. Microsoft, Amazon, Google, Meta combined 2026 capex ≈ $290B+; even a 10% trim ripples hard.
- **Margin compression.** Quanta's Q1 GM fell 154 bps as GB300 dilutes — "higher revenue dilutes the gross margin percentage" is now structural; investors must watch absolute $ profit not GM%.
- **Geopolitical / tariff.** 25% Liberation Day tariffs on semi equipment; Middle East conflict cited by Foxconn as its #1 external risk; potential Taiwan Strait headlines.
- **Customer concentration.** Wiwynn ~95% of A/R in 3 customers; Inventec ~50% of AI-server revenue from China; switching costs cut both ways.
- **Cyber/operational.** Foxconn North America plants hit by a cyberattack May 12, 2026 (recovering).
- **Memory cost squeeze.** Inventec flagged laptop memory shortage; HBM/DRAM tightness can compress margins through 2026.
- **AMD/ZT divestment.** Reshuffles the AMD AI rack supply chain — Compal/Wiwynn/Jabil bidding; winner gets a step-change but unsettles the loser.
- **Allocation shifts.** Nvidia can move allocation between Foxconn/Quanta/Wistron each cycle; Vera Rubin (NVL72, NVL576 "Kyber") is the next allocation reset, expected late 2026-2027.

## Cross-cutting

- **NVDA (A1):** ODMs are the physical-build layer of NVDA's GB200/GB300/Vera Rubin cycle. Every NVL72 rack = ~$2-3M and Foxconn/Quanta/Wiwynn take the lion's share. Rubin NVL576 "Kyber" announced at GTC 2026 is the next ODM allocation reset.
- **Dell (B?):** Dell does not build servers — it designs and orchestrates supply chain; Foxconn, Wistron, and (incoming) Compal are the actual builders of XE9712/XE9680 racks. Dell margins are sales/service; ODM margins are factory + assembly.
- **SMCI (B?):** The notable exception — vertically integrated, in-house San Jose + Malaysia rack assembly + Ablecom/Compuware sister cos. Less ODM-dependent than Dell/HPE.
- **HPE (B?):** Uses Foxconn/Inventec/MiTAC for AI-server assembly; less aggressive on rack-scale than Dell.
- **OpenAI/Oracle Stargate (datacenter):** Foxconn Mexico is the assembly anchor; 64k GB200 at Abilene TX (16k by summer 2026).
- **TSMC (semis manuf):** Every Blackwell/Rubin die these ODMs install starts at TSMC CoWoS-L; ODM throughput is gated by upstream CoWoS capacity.
- **Liquid cooling (C?):** GB200/300 racks (~120 kW) and Rubin (~24 kW per 2U) force direct liquid cooling; benefits Vertiv, Boyd, AVC, Delta, Auras, Asia Vital Components — ODMs are pulling these suppliers along.
- **Power/electrical (C/D?):** 120 kW/rack means new busbars, BBU, 800V DC; Foxconn explicitly showcased GB300 Power Clip + Busbar cable.
- **Hyperscaler capex (E?):** MSFT $80B FY26, GOOG $75B 2026, AMZN "highest ever", META $64-72B = ~$290B+ flowing into ODM order books.
- **Inspur sanctions (geopolitics):** US ODMs (Foxconn, Quanta, Wiwynn, Inventec) directly benefit from China being shut out of Blackwell/Rubin — Inspur unit volume that would have absorbed top-bin Nvidia parts now redirects to US/EU/sovereign-AI buyers via Taiwan ODMs.
- **AMD MI300/MI355X (semis):** AMD-route ODMs are Inventec, MiTAC, Pegatron, Compal, Wiwynn; ZT Systems plant divestment auction is the immediate catalyst.

## Sources

- [Foxconn Q1 2026: $66.6B Revenue on 30% AI Server Surge — tech-insider.org](https://tech-insider.org/foxconn-q1-2026-ai-server-revenue-66-billion/)
- [Foxconn Revenue Jumps 21.6% to NT$1.33 Trillion as AI Server Demand Builds — Yahoo Finance](https://finance.yahoo.com/news/foxconn-revenue-jumps-21-6-210301343.html)
- [Foxconn sees record April revenue amid AI server rack growth — Seeking Alpha](https://seekingalpha.com/news/4585375-foxconn-sees-record-april-revenue-amid-ai-server-rack-growth)
- [Foxconn Expects AI Demand to Remain Strong — MarketScreener](https://www.marketscreener.com/news/foxconn-expects-ai-demand-to-remain-strong-sees-limited-mideast-impact-update-ce7e5edada81f62c)
- [Foxconn's 30 Percent Revenue Jump — Startup Fortune](https://startupfortune.com/foxconns-30-percent-revenue-jump-is-the-manufacturing-economy-of-ai-infrastructure-showing-up-before-the-software-economics-do/)
- [Hon Hai Precision Industry (2317.TW) overview — Stock Analysis](https://stockanalysis.com/quote/tpe/2317/)
- [Foxconn market cap — CompaniesMarketCap](https://companiesmarketcap.com/foxconn/marketcap/)
- [Nvidia, Foxconn to Deploy Humanoid Robots at Houston Factory for GB300 — MLQ.ai](https://mlq.ai/news/nvidia-foxconn-to-deploy-humanoid-robots-at-houston-factory-for-gb300-ai-server-production/)
- [Foxconn Builds NVIDIA AI Servers in Mexico for Stargate Project — Mexico Business](https://mexicobusiness.news/cloudanddata/news/foxconn-builds-nvidia-ai-servers-mexico-stargate-project)
- [Foxconn Plans to Build World's Largest Nvidia GB200 Chip Factory — Yahoo Finance](https://finance.yahoo.com/news/foxconn-plans-build-worlds-largest-171734897.html)
- [AI Server Market Shipment Growth 2026 Foxconn Wistron Quanta GB200 GB300 Forecasts — Technetbook](https://www.technetbooks.com/2026/03/ai-server-market-shipment-growth-2026.html)
- [Quanta FY2026 Q1 Earnings Call — BigGo Finance](https://finance.biggo.com/news/TW_2382.TW_2026-05-14)
- [Quanta to make NVIDIA GB200 AI servers for Google, Amazon, Meta — TweakTown](https://www.tweaktown.com/news/97169/quanta-computer-to-make-nvidia-gb200-based-ai-servers-for-google-amazon-and-meta/index.html)
- [Quanta Computer (2382) overview — Stock Analysis](https://stockanalysis.com/quote/tpe/2382/)
- [Quanta Computer market cap — Stock Analysis](https://stockanalysis.com/quote/tpe/2382/market-cap/)
- [Wiwynn: The Heavy Metal Behind AI — Silba Substack](https://silbadeepdives.substack.com/p/6669-wiwynn-the-heavy-metal-behind)
- [Microsoft, Meta Ramp Up AI Spend, Lifting Foxconn, Quanta and Wiwynn — TrendForce](https://www.trendforce.com/news/2025/05/05/news-microsoft-meta-ramp-up-ai-spend-lifting-nvidias-taiwanese-odm-partners-foxonn-quanta-and-wiwynn/)
- [Wiwynn (6669) overview — Stock Analysis](https://stockanalysis.com/quote/tpe/6669/)
- [Wiwynn market cap — Stock Analysis](https://stockanalysis.com/quote/tpe/6669/market-cap/)
- [Inventec FY2026 Q1 Earnings Call — BigGo Finance](https://finance.biggo.com/news/TW_2356.TW_2026-05-12)
- [Inventec Surges Over 8% on Record Profit — BigGo Finance](https://finance.biggo.com/news/L7z-Ip4BrX5PFN7BUy2v)
- [Inventec posts record March and 1Q26 revenue on AI server strength — Digitimes](https://www.digitimes.com/news/a20260409PD244/inventec-revenue-shipments-ai-server-2026.html)
- [Inventec FY2025 Q4 Earnings Call — BigGo Finance](https://finance.biggo.com/news/TW_2356.TW_2026-03-11)
- [Inventec expects revenue growth in 2026 — Taipei Times](https://www.taipeitimes.com/News/biz/archives/2025/11/12/2003847039)
- [The Second Phase of AI: Pegatron, Compal, Inventec Bet on System Assembly — CommonWealth Magazine](https://english.cw.com.tw/article/article.action?id=4603)
- [Pegatron expects tenfold growth in AI servers — Digitimes](https://www.digitimes.com/news/a20260528PD243/pegatron-ai-server-business-growth.html)
- [Pegatron (4938) overview — Stock Analysis](https://stockanalysis.com/quote/tpe/4938/)
- [Compal Introduces High-Density NVIDIA HGX Rubin NVL8 at GTC 2026 — PR Newswire](https://www.prnewswire.com/news-releases/compal-introduces-high-density-nvidia-hgx-rubin-nvl8-integrated-solution-at-gtc-2026-302715598.html)
- [Compal Showcases 'One Integrated Solution' at NVIDIA GTC 2026 — PR Newswire](https://www.prnewswire.com/news-releases/compal-showcases-one-integrated-solution-rack-level-ai-infrastructure-architecture-and-cross-domain-applications-at-nvidia-gtc-2026-302712140.html)
- [AMD AI server plants to draw bids from Compal, Wiwynn, Jabil — Investing.com / Bloomberg](https://www.investing.com/news/stock-market-news/amd-ai-server-plants-to-draw-fresh-bids-from-compal-wiwynn-and-jabil--bloomberg-3984755)
- [MiTAC Computing Brand Consolidation — HPCwire](https://www.hpcwire.com/off-the-wire/mitac-computing-achieves-brand-consolidation-expands-server-business/)
- [Mitac expands US server capacity, eyes growth in 2026 — Digitimes](https://www.digitimes.com/news/a20260303PD235/mitac-servers-profit-revenue-2026.html)
- [MiTAC Computing at CloudFest 2026](https://www.mitac.com/en-global/news_room/detail/CloudFest2026)
- [MiTAC at NVIDIA GTC 2026](https://www.mitac.com/en-global/news_room/detail/GTC2026)
- [US blacklists China's largest server maker Inspur — DCD](https://www.datacenterdynamics.com/en/news/us-government-blacklists-chinas-largest-server-maker-inspur-used-by-cisco-ibm-intel-nvidia/)
- [US extends AI trade blacklist — Taipei Times](https://www.taipeitimes.com/News/biz/archives/2025/03/27/2003834112)
- [Dozens of banned Chinese offshoots added to US entity list — The Register](https://www.theregister.com/2025/03/26/us_entity_list_subsidiaries/)
- [US expands China trade blacklist, closes subsidiary loopholes — Tom's Hardware](https://www.tomshardware.com/tech-industry/us-expands-china-trade-blacklist-closes-susidiary-loopholes)
- [US blacklists 50+ Chinese companies to curb AI/chip capabilities — CNBC](https://www.cnbc.com/2025/03/26/us-blacklists-50-chinese-companies-in-bid-to-curb-beijings-ai-chip-capabilities.html)
- [AI drives revenue growth for major electronics ODMs — Digitimes](https://www.digitimes.com/news/a20250120PD231/2025-ai-server-odm-foxconn-quanta-wistron-pegatron-inventec-compal.html)

## _new_nodes_suggested

- **Wistron (3231.TW) / Wiwynn parent** — Wistron itself is now larger than Quanta by revenue (>NT$2T, +108% YoY 2025); separate node warranted. Owns most of Wiwynn (~27%) and is also Nvidia DGX assembly partner.
- **Foxconn Industrial Internet (FII, 601138.SH)** — Shanghai-listed Foxconn cloud/AI subsidiary; pure-play AI exposure without iPhone drag; often a better vehicle than 2317.
- **AMD/ZT Systems divestiture auction** — Compal/Wiwynn/Jabil bidding; resolution will shift AMD-route AI-rack assembly market share materially.
- **Liquid cooling supply chain** — AVC, Auras, Asia Vital Components, Delta Electronics, Boyd, Vertiv — pulled along by GB200/300 thermal density; deserves own node.
- **Ablecom / Compuware** — SMCI's sister/captive suppliers in Taiwan; explain why SMCI is structurally different from Dell/HPE in ODM dependency.
- **Jabil (JBL)** — non-Taiwan ODM bidding on AMD/ZT and increasingly relevant in US AI-server assembly.
- **Sanmina, Flex** — US EMS doing AI-rack integration for sovereign/defense buyers.
- **Chinese alt-AI server stack** — H3C, Sugon, Lenovo, Nettrix taking share from Inspur post-sanctions, paired with Huawei Ascend / Cambricon / Moore Threads accelerators.
- **Foxconn humanoid robot / NVIDIA Isaac GR00T** — Houston deployment is a real, near-term commercialization of physical AI; cross-node link to NVDA robotics thesis.
- **OpenAI/Oracle Stargate buildout** — Abilene TX (64k GB200), Pennsylvania, Wisconsin, Oregon sites — own node for the demand-pull side.

---

## Connectors — Amphenol, TE, Molex

## Current state (May 2026)

Connectors have been one of the most overlooked, mechanically levered AI plays of the cycle. Every GB200 NVL72 rack ships with ~5,000+ high-speed copper cables (>2 miles of copper, ~$220K of cable per rack) and Amphenol designs and manufactures the proprietary NVLink spine cartridges that physically wire 72 GPUs into one NVLink domain.

**Amphenol (APH)** — the clear leader. 2025 revenue $23.1B (+51.7% YoY) and EPS +76%; IT Datacom ran +110–120% organic in 2025. Q4'25 organic +37%, Q1'26 set an all-time record at $7.62B sales (+58% reported, +33% organic), IT Datacom hit 41% of total revenue growing +99% reported / +81% organic, and orders printed $9.4B (book-to-bill 1.24). Q2'26 guide $8.1–8.2B with EPS $1.14–1.16. Stock: 5Y total return ~308%, TTM ~52%, 52-wk range $83.44–$167.04. The Jan'26 print initially sold off ~10% on light Q1 guide and CommScope-CCS dilution; the Q1 beat re-rated shares +9.5% in pre-market on Apr 29. JPMorgan target $190, Evercore $180, UBS $170. Market cap ~$160B. The $10.5B CommScope CCS deal (closed Jan 9, 2026) adds ~$4.1B of fiber/cable revenue in 2026 and ~$0.15 of EPS accretion — pivots the mix more deeply into AI fiber. Key AI products: NVLink spine cartridge (MPN 965249720020000), Paladin HD 224G connector, OverPass cable assemblies, copper cable cartridges for GB200/GB300.

**TE Connectivity (TEL)** — the laggard with catch-up potential. FY25 revenue $17.26B (+8.9%); AI/DDN revenue was only $1.4B in 2025, guided to ~$2.4B in FY26 (raised $150M mid-year) and projected >$3B by 2027. Q2 FY26 (Apr 22, 2026): $4.74B sales (+14%), EPS $2.73, record orders $5.3B (+25%), Q3 guide $5.0B. Stock: TTM +52%, 52-wk $158–$252.56, market cap ~$64B. Despite the strong print, shares fell ~7% post-Q2 on questions about CPO/co-packaged-optics displacing copper. Analyst PT $264.74 avg.

**Molex (private, Koch Industries)** — third pillar, named by NVIDIA as a Blackwell DCI partner alongside Amphenol. Listed among the AEC tier-1 trio (Molex/Amphenol/TE) that together hold >45% of the AEC data-center market in 2025. No public stock; Koch shareholders capture the value. Generally viewed as a #2 alternate to Amphenol on NVIDIA programs.

**Leader/laggard call:** Amphenol has run furthest (5Y +308%, +52% TTM, P/E 32.6x — ~25% premium to sector). TE has lagged on perceived smaller AI mix and CPO overhang despite very similar TTM stock performance — narrative gap is the opportunity. Molex is private and not directly investable.

## $ content per AI rack

- A GB200 NVL72 rack uses **5,184 NVLink copper cables** to connect 72 GPUs with 130 TB/s of fabric bandwidth and 1.8 TB/s per GPU. Total length >2 miles per rack.
- Cable BOM per rack ≈ **$220,000** — only ~1/6 the cost of an equivalent optical solution and saves ~20 kW of transceiver/retimer power.
- The NVLink spine cartridge alone (Amphenol-custom) costs several thousand dollars; SemiAnalysis estimates the backplane assembly costs several thousand dollars per board because of premium connectors.
- Implied Amphenol content per NVL72 rack: low-to-mid six figures (cables + cartridges + power connectors + blind-mate liquid-cool connectors + busbar/connector hardware rated at 1,400 A and 6,000 lb mating force).
- With B200/GB200 backlog ~3.6M units sold out through mid-2026 and 2026 hyperscaler capex tracking >$650B, the connector TAM compounds.
- **Forward risk to APH content**: NVSwitch trays in some GB300 variants are migrating from OverPass cables to PCB designs; the Kyber 3 concept rack shown at GTC 2025 had **no cable cartridges at all** — connectors get displaced by midplane PCB + high-speed connectors. This is the single biggest bear point on APH content per rack.

## Lagged / undervalued comparables

- **TE Connectivity (TEL)** — the obvious lagging large-cap; AI mix smaller (~14% of FY26 sales) but doubling 2025→2027. CPO fear is overdone in the near term.
- **Bel Fuse (BELFA/BELFB)** — small cap ($300/share area, ~$3B mkt cap). 2025 sales $675M (+26%), Q1'26 +17% with AI data solutions called out as a growth driver. Bought Methode's dataMate copper-transceiver business (~$18M sales) in March 2026 for $16M. Raised ~$399M in May 2026 to fund Enercon close + M&A. Northland PT $321. Smaller-cap, more leveraged story.
- **Methode Electronics (MEI)** — sold dataMate to BEL; pivoting to power-delivery products for AI density. Restructuring story, not yet AI-narrative.
- **CommScope (COMM)** — has divested its valuable CCS/Andrew/outdoor businesses to Amphenol; residual co is much less interesting as a pure-AI play.
- **Volex (LON:VLX)** — UK-listed; data-centre power and connectivity is one of three core verticals. Less covered by US investors; small-cap optionality. Reports near 26 May 2026.
- **Rosenberger** — private German specialty connector maker; high-frequency RF and high-speed copper for hyperscale; not investable directly.
- **Luxshare Precision (Chinese)** — Tier-2 AEC supplier expanding globally; named in Credo IP suits.
- **JPC Connectivity, Infraeo** — niche high-speed cable specialists.

## Cross-cutting

- **AEC overlap with Credo (W2)**: Credo sued Amphenol, Molex, TE, and Volex in March 2025 over AEC patents. **Amphenol settled Aug 14, 2025** (license + settlement, terms confidential). **TE settled by March 2026.** Molex and Volex appear still in litigation. Credo holds the DSP/silicon IP; the trio holds the manufacturing scale — they are now economic partners, not pure competitors. Tracks to the W2 networking-silicon node.
- **Transceivers (Lumentum/Coherent, W2)** are the substitute technology if copper loses out at scale-up; today copper wins inside the rack on cost (1/6th) and power (-20kW). 1.6T/224G per lane (DesignCon 2026) extended copper's runway one more generation.
- **CPO (co-packaged optics)** is the structural threat to the entire copper-connector thesis. NVIDIA roadmap (Kyber concept) is the canary.
- **Liquid-cool + blind-mate connectors**: 6,000 lb mating force, 1,400 A busbars — physical complexity is itself a moat for the incumbent trio.
- **CommScope CCS** moved fiber data-center connectivity from COMM to APH in Jan 2026, consolidating the U.S. supplier base.

## Risks

1. **CPO / optical displacement** — if NVIDIA or hyperscalers move scale-up traffic to optics inside the rack faster than copper roadmaps can deliver (224G then 448G/lane), the per-rack copper $ content shrinks materially.
2. **PCB midplane displacement** — GB300 and Kyber 3 architectures hint at replacing OverPass cable cartridges with midplane PCBs; APH content per rack could compress one-to-two generations out.
3. **Customer concentration** — IT Datacom is now 41% of APH and very NVIDIA-skewed; any hyperscaler capex pause hits APH harder than the diversified historical mix.
4. **Valuation** — APH trades 32.6x forward, ~25% premium to sector with a D Value Score; bar is high.
5. **CommScope-CCS integration & leverage** — APH added ~$18.7B of debt; initially margin-dilutive. Tax rate stepped up from 24.5% to 27% (China accrual + recurring).
6. **AEC IP** — Credo settlements were positive but ongoing royalty obligations not disclosed.
7. **Geopolitics** — China tax accruals of $130M (Q1'26) + $100M (Q4'25), recurring tax-rate headwind.

## Sources
- [Amphenol Reports Record First Quarter 2026 Results](https://investors.amphenol.com/news-and-events/news-details/2026/Amphenol-Reports-Record-First-Quarter-2026-Results/default.aspx)
- [Amphenol Q4 2025 8-K](https://www.sec.gov/Archives/edgar/data/0000820313/000110465925101429/aph-20251022xex99d1.htm)
- [Amphenol Q1 2026 8-K (CommScope close)](https://www.sec.gov/Archives/edgar/data/0000820313/000110465926002737/tm262701d1_ex99-1.htm)
- [Amphenol Completes Acquisition of CCS Business From CommScope](https://investors.amphenol.com/news-and-events/news-details/2026/Amphenol-Completes-Acquisition-of-CCS-Business-From-CommScope/default.aspx)
- [TE Connectivity Q2 FY2026 8-K](https://www.sec.gov/Archives/edgar/data/0001385157/000110465926046285/tel-20260422xex99d1.htm)
- [TE Connectivity FY2025 Q4 8-K](https://www.sec.gov/Archives/edgar/data/0001385157/000110465925103388/tel-20251029xex99d1.htm)
- [TE Connectivity: Technological Uncertainty Limits The Near-Term AI Upside (Seeking Alpha)](https://seekingalpha.com/article/4892190-te-connectivity-stock-technological-uncertainty-limits-near-term-ai-upside)
- [NVIDIA Contributes GB200 NVL72 Designs to Open Compute Project](https://developer.nvidia.com/blog/nvidia-contributes-nvidia-gb200-nvl72-designs-to-open-compute-project/)
- [GB200 Hardware Architecture & BOM (SemiAnalysis)](https://newsletter.semianalysis.com/p/gb200-hardware-architecture-and-component)
- [NVIDIA's Optical Boogeyman – NVL72 (SemiAnalysis)](https://newsletter.semianalysis.com/p/nvidias-optical-boogeyman-nvl72-infiniband)
- [Nvidia GPU Copper Cable Interconnect Technology Explained](https://www.diskmfr.com/nvidia-gpu-copper-cable-interconnect-technology-explained/)
- [Is Amphenol Dead Beyond NVL72? (Global Tech Research)](https://globaltechresearch.substack.com/p/nvidia-nvda-us-2025-gtc-review-is)
- [Credo and Amphenol Reach Settlement in AEC Patent Disputes](https://www.businesswire.com/news/home/20250814901331/en/Credo-and-Amphenol-Reach-Settlement-in-Active-Electrical-Cable-Patent-Infringement-Disputes)
- [The Connectivity Fabric of the AI Era: Credo (iamfabian)](https://iamfabian.substack.com/p/the-connectivity-fabric-of-the-ai)
- [AEC Active Cable for Data Centers Market Outlook 2026-2034](https://www.intelmarketresearch.com/aec-active-cable-for-data-centers-market-27749)
- [Bel Fuse Announces Acquisition of dataMate from Methode (Mar 2026)](https://www.globenewswire.com/news-release/2026/03/05/3250689/0/en/Bel-Fuse-Inc-Announces-Acquisition-of-dataMate-an-advanced-ethernet-and-broadband-business-from-Methode-Electronics-Inc.html)
- [Amphenol (APH) Stock Overview — StockAnalysis](https://stockanalysis.com/stocks/aph/)
- [TE Connectivity (TEL) Stock Overview — StockAnalysis](https://stockanalysis.com/stocks/tel/)
- [Buy Amphenol on the Dip After Robust Q4 Earnings (Globe and Mail)](https://www.theglobeandmail.com/investing/markets/stocks/APH/pressreleases/37359581/buy-amphenol-on-the-dip-after-robust-q4-earnings-and-solid-guidance/)
- [Amphenol APH Stock Moved Up 4.70% on May 28 (TradingKey)](https://www.tradingkey.com/news/market-movers/261934226-market-movers-aph-20260528)
- [Volex Investors page](https://www.volex.com/investors)

---

## Power management — MPWR, Delta, Vicor

## Current state (May 2026)

Power management has become the *non-GPU* AI trade. Every NVDA Blackwell/Rubin GPU needs dozens of voltage rails plus 48V→core converters; every rack needs PSUs, BBUs, capacitor shelves; the industry is mid-migration from 415/480 VAC → 48V DC → **800V DC** (NVDA MGX). The supplier list is finally fragmenting into winners and laggards.

**MPWR (Monolithic Power) — ~$1,633, mkt cap ~$78B**
- 2025 total return: **+54.4%** (vs −5.6% in 2024).
- 2026 YTD: hit ATH $1,661 on Apr 24, currently ~$1,633.
- Q1'26 record rev $804M (+26% YoY); CEO Hsing: "we keep winning".
- Enterprise Data growth guidance ratcheted: 30–40% → 50%+ → **85%+ YoY for 2026**.
- Owns the 12V→1V VRM socket on the GB200 Bianca board; sampling 800 VDC solutions for Blackwell/Vera Rubin.
- KeyBanc PT raised to $2,000 (from $1,500).
- Bull narrative: potential **~70% share in NVDA Vera Rubin** sockets.
- Open wound: late-2024 Edgewater scare cut MPWR ~20% on rumored share loss to Infineon/Renesas on Blackwell; that fear has now reversed but Infineon is the live competitor.

**Delta Electronics (2308.TW) — ~NT$2,350, 52-wk low NT$365**
- 52-wk range NT$365–NT$2,410 → roughly **+540%** from trough; one of the great single-stock moves of the cycle.
- 2025 rev NT$555B (+31.8%); EPS +70.6%; GM 34.6% (up from 29.5% in 2023) on liquid cooling + AI mix shift.
- Oct'25 monthly rev NT$57.4B (+48% YoY); Infrastructure segment +159% YoY; liquid cooling alone NT$10B (17% of rev).
- Owns the GB200/GB300 power-shelf socket. **GB300 carries ~30% more power-content value vs GB200**.
- Trades as an NVDA-correlated AI infra proxy now, not as an industrial. 

**Vicor (VICR) — ~$350, mkt cap ~$15.6B**
- 52-wk range $41.76–$361.89 → ~**+700%** TTM. **YTD 2026 ~+75%** off Jan low.
- Q4'25 EPS $1.01 vs $0.44 est; 2025 EPS $2.63 vs $0.14 in 2024 (earnings +1,834%).
- Q1'26 rev $113M (+20% YoY), GM expanded to 55.2%.
- May 26, 2026: raised Q2 guide to $142M (from $126M) on new royalty licensee → stock +13.7% in one day.
- Owns 48V→core VPD modules + 800V-to-48V automotive-grade modules; second CHiP fab planned; ITC investigation into infringing NBM importers underway (licensing = high-margin revenue stream).
- The pure-play AI-power small cap; rerated from forgotten name to crowded long.

## $ content per AI rack

- **GB200 NVL72**: 72 GPUs, 120 kW actual draw, **198 kW PSU capacity** (36×5.5 kW PSUs across 6 power shelves, ~50–60% loading for redundancy).
- **GB300**: ~+30% power-content value vs GB200 per rack (Delta disclosure).
- **NVDA Rubin Ultra / Kyber rack (2027)**: target ~**1 MW per rack** on 800 VDC.
- Power-tree dollar split per GB200 rack (approximate, mfg POV):
  - **AC→DC PSUs + power shelf**: Delta (anchor), Lite-On, Vertiv-adjacent — biggest single $ block.
  - **48V→12V IBC**: Infineon, MPS, Vicor — high-margin module slot.
  - **12V→1V VRM** on GPU board (Bianca): **MPWR primary**, Renesas/Infineon secondary. MPWR content per Blackwell GPU widely cited in sell-side notes at **$300–$500/GPU** (no MPWR official confirmation, but consistent with rack VRM count × ASP).
  - **Cap shelves / BBU / e-fuses**: Lite-On, ON Semi, Infineon.
- 800 VDC architecture compresses the power tree: solid-state transformer takes facility MV → 800 VDC, then a **single 64:1 LLC DC-DC** in the rack instead of multiple AC and DC stages. This *increases* per-rack dollar content for component vendors with 800V parts (Vicor, MPS, Infineon, ON Semi) and *reduces* it for vendors stuck at 12V/48V topology.

## Lagged / undervalued comparables

**Infineon (IFX.DE) — "everyone forgot about it"**
- 2025 calendar return ~+15–25% (lagged MPWR's +54% and Delta's parabolic move).
- 2026 YTD mostly sideways in low-€40s — until **May 29, 2026: joined NVDA MGX 800 VDC ecosystem**.
- Edgewater earlier flagged Infineon as **60–70% Blackwell power-management share** taker (the body blow to MPWR thesis).
- Power-supply-unit business guided €250M (2024) → **€1.5B (2026)**, ~6× in 2 years.
- JPMorgan PT raised to €74 from €48; Morgan Stanley to €63 from €58.
- *This is the catch-up trade. If 800V is real and MGX scales, IFX rerates closer to MPWR's multiple.*

**ON Semiconductor (ON) — recovering from cyclical bottom**
- Stock ~$104, near 52-wk high; **+143% TTM** but well below MPWR/Vicor/Delta on multi-year basis.
- Q3'25 AI data center rev **doubled YoY**; guided to **double again in 2026**.
- SiC + GaN positioning for high-voltage 800 VDC switching — fits NVDA roadmap.
- LT model: 53% GM, 40% OM, 25–30% FCF margin (vs 2025 actuals 38.4% / 18.6%).
- US-domiciled = tariff/security tailwind.
- *Cleanest "discounted way to play AI power" if you believe the SiC/GaN handoff.*

**STMicroelectronics (STM)**
- 2025: −8% calendar return. 2025 rev $11.8B (−11% YoY); 2025 EPS −89%.
- Q1'26 rev $3.10B +23% YoY; stock has rallied hard off bottom — $22.35 (1/2/26) → ~$65 by mid-May → **~+180% YTD**.
- AWS multi-year multi-billion deal (Feb'26) + Innoscience GaN JDA for AI data center.
- Morgan Stanley PT €74 (from €46).
- *Was the most-hated name in the group; the rerating has already started but lags Vicor/Delta in absolute %.*

**TXN (Texas Instruments)**
- Q1'26 data center rev +90% YoY +25% QoQ; 2025 data center run-rate $1.2B (+50% YoY).
- New 300mm Sherman, TX fab online Dec'25 → capacity to scale.
- CEO line: "doesn't matter if your rack runs Blackwell or whatever comes after; it still needs clean power".
- Less AI-pure than MPWR; valuation more reasonable; still benefits but capex drag limits multiple expansion.

**ADI (Analog Devices)**
- Q2 FY26 rev $3.62B +37% YoY; data center grew ~50% in FY25 and accelerating.
- **May 19, 2026: announced $1.5B all-cash acquisition of Empower Semiconductor** → straight-line bet on vertical-power-delivery for AI compute. Direct competitive shot at MPWR/Vicor.
- CEO Roche framing: power delivery = "vascular system" of AI.
- *Watch for ADI to be repositioned as a power-IC AI name post-Empower close.*

**Lite-On (2301.TW)**
- ~NT$240, 52-wk range NT$100–NT$246 → **+~140% TTM**, **+102% YoY**.
- 2025 rev +21%; 2026 rev forecast +21%, EPS +30%.
- GTC 2026 showcase: 800 VDC power racks, 110 kW power shelves, BBU, capacitor shelf, 2.1 MW in-row CDU — full megawatt-rack stack.
- Acquired U-MEDIA for NT$2B (Jan'26) to add AI-RAN/edge stack.
- *Plays the same Delta game but smaller-cap, lower mind-share. Q1'26 EPS missed by 41% — risk if AI capex blinks.*

## Cross-cutting connections

- **NVDA → A1 (NVDA node)**: 800 VDC MGX ecosystem (May 29, 2026) is the unifying spec — picks winners.
- **B3 → Datacenter build-out**: ABB, Eaton, Vertiv, Schneider, GE Vernova, Siemens, Hitachi Energy, Mitsubishi (>20 partners) — see datacenter / utilities nodes.
- **B3 → Cooling**: Liquid cooling and high-density power are joint constraints; Delta straddles both.
- **B3 → Memory / HBM**: irrelevant directly, but rack-power budget is shared.
- **Competitive overlap on the Blackwell VRM socket**: MPWR vs Infineon vs Renesas → if Infineon really takes 60–70%, MPWR's multi-quarter AI growth slows even as company narrative says otherwise.

## New nodes to consider

- **Renesas (6723.T)**: the third VRM competitor to MPWR/Infineon on Blackwell digital power — currently uncovered.
- **Empower Semiconductor (post-ADI close)**: vertical-power-delivery pure play, now inside ADI.
- **Vertiv (VRT)** and **Eaton (ETN)**: rack/infrastructure-level 800 VDC plays (already partially under datacenter node — flag overlap).
- **Navitas (NVTS) / Power Integrations (POWI)**: GaN/SiC pure plays that benefit from 800 VDC switching.
- **AOS, Wolfspeed**: SiC supply side.

## Risks

1. **MPWR socket loss on Blackwell** — Edgewater thesis (Infineon/Renesas take share) is still live. If GB300/Rubin VRM mix is 50/50 not 70/30 MPWR, 2026 revenue guide is at risk.
2. **Hyperscaler vertical integration of power** — bears on Delta argue NVDA/Microsoft/Meta could commoditize power modules and turn vendors into low-margin assemblers. NVDA MGX *open* reference design accelerates this.
3. **800 VDC adoption timing** — Vertiv 800V product H2'26; Rubin Ultra Kyber mass deployment 2027. A 12-month slip means VICR/IFX/MPS 800V revenue doesn't show up when modeled.
4. **Crowded long** — VICR at 114x P/E, MPWR ~$78B mkt cap on $3.7B '26 rev (~21x sales); Delta's NT$365→NT$2,350 move means any AI capex pause hits hard.
5. **China/Taiwan supply concentration** — Delta and Lite-On both Taiwan-listed; tariff/cross-strait risk asymmetric vs MPWR/Vicor.
6. **Patent litigation overhang for VICR's competitors** — ITC actions reduce supply but also test customer tolerance for sole-source Vicor.

## Sources
- [MPWR — Efficiency Layer of the AI Supercycle (Simply Wall St)](https://simplywall.st/community/narratives/us/semiconductors/nasdaq-mpwr/monolithic-power-systems/cafbznfq-monolithic-power-systems-mpwr-the-efficiency-layer-of-the-ai-supercycle)
- [MPWR Rose 5% This Week — TIKR](https://www.tikr.com/blog/monolithic-power-systems-rose-5-this-week-heres-what-could-drive-the-stock-in-2026)
- [MPWR 2025 Total Return +54.45% (FinanceCharts)](https://www.financecharts.com/stocks/MPWR/performance/total-return)
- [Is MPWR a Short? — The GB200 Power Module War (Global Tech Research)](https://globaltechresearch.substack.com/p/is-monolithic-power-system-mpwr-us)
- [MPWR Dips on Concerns Over NVDA Allocation (GuruFocus)](https://www.gurufocus.com/news/2595820/mpwr-stock-dips-on-concerns-over-nvidia-gpu-allocation)
- [Vicor Q1 2026 8-K (SEC)](https://www.sec.gov/Archives/edgar/data/0000751978/000119312526165105/d139425dex991.htm)
- [Vicor lifts Q2 2026 guide to $142M (StockTitan)](https://www.stocktitan.net/news/VICR/vicor-corporation-revises-q2-2026-revenue-03bgkaouw54h.html)
- [VICR Stock Overview (StockTitan)](https://www.stocktitan.net/overview/VICR/)
- [Delta Electronics 2308.TW (Yahoo Finance)](https://finance.yahoo.com/quote/2308.TW/)
- [Delta October revenue hits record on AI power (Investing.com)](https://in.investing.com/news/stock-market-news/delta-electronics-october-revenue-hits-record-high-on-ai-power-demand-93CH-5096430)
- [Stock 101: Delta Electronics — Powering AI Infrastructure](https://encyclopediaofstocks.substack.com/p/stock-101-delta-electronics-2308tt)
- [Lite-On Technology 2301.TW (Yahoo Finance)](https://finance.yahoo.com/quote/2301.TW/)
- [Lite-On advances 800V HVDC for MW power era (Digitimes)](https://www.digitimes.com/news/a20251120PD226/lite-on-technology-infrastructure-manufacturing-taiwan-chips.html)
- [Infineon joins NVDA MGX 800V (StockTitan)](https://www.stocktitan.net/news/IFNNY/infineon-joins-nvidia-s-mgxtm-ai-factory-ecosystem-to-transform-yq7il07nnd10.html)
- [Infineon Joins NVDA MGX (Telecom Reseller, May 29 2026)](https://telecomreseller.com/2026/05/29/infineon-joins-nvidias-mgx-ai-factory-ecosystem-to-transform-power-delivery-architecture-for-next-generation-ai-server-racks/)
- [ADI Acquires Empower Semiconductor for $1.5B (ADI 8-K)](https://www.sec.gov/Archives/edgar/data/0000006281/000000628126000048/pressrelease.htm)
- [ADI vs TXN: AI Semiconductor Comparison (Yahoo)](https://finance.yahoo.com/markets/stocks/articles/adi-vs-txn-ai-semiconductor-151100400.html)
- [Analog Chip Stocks Powering AI (IndMoney)](https://www.indmoney.com/blog/us-stocks/analog-chip-stocks-ai-data-center-boom)
- [ON Semi Q1 2026 — AI Data Center Drives Recovery (Investing.com)](https://www.investing.com/news/company-news/on-semiconductor-q1-2026-slides-ai-data-center-surge-drives-recovery-93CH-4657646)
- [ON Semi Projects AI DC Revenue Doubling 2026 (MLQ)](https://mlq.ai/news/onsemi-projects-ai-data-center-revenue-doubling-and-margin-gains-for-2026/)
- [STM Q1 2026 6-K (SEC)](https://www.sec.gov/Archives/edgar/data/0000932787/000093278726000022/q126earningspressrelease-2.htm)
- [Preparing for 800 VDC Data Centers: ABB, Eaton, NVDA (Data Center Frontier)](https://www.datacenterfrontier.com/energy/article/55323139/preparing-for-800-vdc-data-centers-abb-eaton-support-nvidias-ai-infrastructure-evolution)
- [NVDA 800V rollout supported by ABB (Tom's Hardware)](https://www.tomshardware.com/tech-industry/big-tech/nvidia-800-vdc-power-rollout-for-1-megawatt-server-racks-to-be-supported-by-abb-company-says-collaboration-will-create-new-power-solutions-for-future-gigawatt-scale-data-centers)
- [ABB to develop next-gen AI data centers with NVDA](https://new.abb.com/news/detail/129805/abb-to-develop-next-generation-ai-data-centers-with-nvidia)
- [NVDA prepares industry for 1MW racks & 800V DC (DCD)](https://www.datacenterdynamics.com/en/news/nvidia-prepares-data-center-industry-for-1mw-racks-and-800-volt-dc-power-architectures/)
- [NVIDIA 800V HVDC Deep Dive (SZSanyi)](https://www.szsanyi.com/en/blog/nvidia-hvdc)

---

## BMC + substrate — ASPEED, Ajinomoto, Ibiden

## Current state (May 2026)

Every AI server needs (a) a baseboard management controller, (b) an ABF-based FC-BGA substrate, and (c) a high-layer-count HDI motherboard. All three sub-chains are running into a structural shortage that started biting in H1 2026 and is forecast to widen into 2028.

**ASPEED Technology (5274.TWO)** — the BMC near-monopoly (>70% global server BMC share). The stock has been *the* AI-pick-and-shovel trade of the cycle. It hit an intraday all-time high of NT$19,195 on May 6, 2026 (52-week range NT$3,680 → NT$19,195, ~+344% TTM; up ~+500% on some trailing measures). Market cap ~NT$650B. 2025 revenue was NT$9.08B (+40.6% YoY). Goldman Sachs has now raised its target price *four times* in 2026, from NT$7,300 at year-start to NT$22,000 — a 3x lift. The bull case: AST2700 (12nm, quad-core Cortex A35, DDR5/PCIe Gen4) carries a 50–60% ASP premium over AST2600 and ramps from ~5% of mix in 2026 → 25% in 2027 → 48% in 2028. Goldman models BMC shipments of 29.5M / 41.6M / 52.8M units for 2026–28 (+56% / +41% / +27% YoY) and blended ASP growth of +19% / +24% / +20%. Foreign-broker targets cluster: HSBC NT$24,000, Citi NT$22,500, Goldman NT$22,000.

**Ajinomoto (2802.T)** — yes, the MSG company. Owns >95% of the Ajinomoto Build-up Film (ABF) market — the insulating film that makes every advanced FC-BGA substrate possible. On May 13, 2026, Digitimes confirmed Ajinomoto has formally notified IC substrate makers of a **30% ABF price hike effective Q3 2026** — the price action our K3 SPOF research flagged. Driver: AI chip stack-ups are migrating from 3+3 → 11+11 → 13+13 layers, blowing out ABF consumption per package. The 30% film hike translates to ~3–6% on total substrate cost, or ~5–10% in published H2 substrate prices (spot already +30%). Ajinomoto is also committing ¥1.2B to a third ABF plant in Gifu (online 2032). The functional-materials segment was the swing factor in Ajinomoto's raised FY2025 guide.

**Ibiden (4062.T)** — the FC-BGA substrate kingpin and the prime ABF user. ~80%+ of its AI substrate revenue is NVIDIA (Blackwell → Rubin → Rubin Ultra: substrate area +80–100% per generation, dollar content +100%+ per gen). FY2025 (ended March 2026) full-year forecast: net sales ¥420B (+13.7%), op income ¥61B (+28.1%); results reported May 11–12, 2026. In February 2026 the board approved its *largest-ever* capex program: ~¥500B over FY2026–28, with ¥220B Phase 1 on Gama Cell 6 (mass production FY2027). Stock did a 2-for-1 split Jan 1, 2026. 52-week range ¥2,956 → ¥15,445. JPMorgan upgraded to Overweight with a ¥12,900 target (vs. ¥6,500 prior). Bernstein Outperform at ¥9,080. BofA models 35% op-profit CAGR over five years for the electronics business. BofA / Goldman / JPM all see ABF supply deficits widening: –10% in H2 2026, –21% in 2027, –42% in 2028.

**Shinko Electric (6967.T)** — the #2 FC-BGA substrate maker — **was taken private March 18, 2025** by the JIC/DNP/Mitsui Chemicals consortium (¥684.9B / $4.7B; JIC 80%, DNP 15%, Mitsui Chem 5%; ¥5,920/share). No longer publicly tradable. Important supply-chain implication: a major Western-accessible substrate name has been removed from the listed universe just as ABF demand inflects.

**Unimicron (3037.TW)** — the cleanest Taiwan ABF + HDI pure-play. The poster child for this trade: trading ~NT$1,080 (May 2026), 52-week range NT$98 → NT$1,110 → **~+726% TTM**. Captures ~35% of NVIDIA high-end GPU ABF and >50% of hyperscaler ASIC substrates (Google TPU, AWS Trainium). Q1 2026: +8% QoQ revenue, 18% gross margin. Morgan Stanley upgraded with a NT$500 → it was already there; consensus 12-mo target now NT$942 (high NT$1,350). Morgan Stanley models 105% EPS CAGR 2025–28. P/E ~75x trailing.

**TTM Technologies (TTMI)** — the US-listed AI-server-PCB + defense combo. 2025 revenue $2.91B (+19%), net income $177M (+215%). Stock surged ~+260% YoY into early 2026; pulled back from $113 high to ~$88 in March, then rallied to ~$157 over 90 days. Data Center Computing revenue +57% in late 2025, +66% guided for Q1 2026. Q1 2026: $846M revenue beat ($787M consensus), book-to-bill 1.41, Q2 guide $930–970M (vs $823M consensus). Aerospace/defense backlog is a record $1.61B (44% of revenue). 80% of revenue is now A&D + data center. Needham target $125, B. Riley $165.

**Zhen Ding (4958.TW)** — Apple's flex-PCB workhorse, pivoting to AI server boards. ~NT$439 (May 2026), 52-week range NT$95 → NT$447 (~+325%+). Capex NT$30B each in 2025 and 2026 for new capacity in Thailand, Jiangsu Huai'an, Taiwan. EPS forecasts revised to NT$16.57 (2026) and NT$24.78 (2027). Trailing PE-driven analysts still flag downside vs. spot (consensus NT$269), suggesting it has *out-run* the AI thesis in flex-PCB land.

**Nan Ya PCB (8046.TW)** — the lagged comparable that has now caught up. Trading ~NT$934 (May 2026), 52-week range NT$98 → NT$1,035 → **~+645% TTM**. Q1 2026: revenue NT$11.2B (+32% YoY), EPS NT$2.03 vs. NT$0.32 a year earlier, margin 12% vs. 2.5%. Morgan Stanley target NT$515 (from NT$165); 113% EPS CAGR 2025–28 model. 2026 revenue consensus lifted from NT$52.7B to NT$58.4B.

## The hidden chokepoint role

1. **BMC = mandatory, one supplier.** Every server motherboard — AI or not — needs a BMC for remote management, fan control, power telemetry. ASPEED is the de-facto monopoly. As CAN-bus power management for high-wattage AI racks becomes standard, the BMC moves from cost-center to platform integrator. AST2700 sells at ~1.5x AST2600 ASP and is ramping into a market where unit growth is *also* +50% YoY.
2. **ABF film = the literal physical bottleneck.** Ajinomoto's >95% share of the build-up film that goes *between every metal layer* of FC-BGA substrates means a single Japanese specialty-chemicals company can dictate the marginal cost of every NVIDIA GPU package. The Q3 2026 30% hike is the second material-cost shock to substrates (after Resonac/MGC's 30% copper-clad laminate hike in April 2026).
3. **Substrate count + layer count both inflating.** AI packages have moved from 3+3 layer ABF stack-ups to 11+11 and 13+13. Substrate area grows 80–100% generation-on-generation (Blackwell → Rubin → Rubin Ultra). The result: ABF demand grows faster than chip unit growth, hence the BofA-modeled 10% → 21% → 42% supply deficit through 2028.
4. **AI motherboards = ~4–8x conventional server PCB cost.** A 20-layer SXM/OAM HDI board prices at ~RMB 12,000/m² vs. ~RMB 3,000/m² for a 10–12-layer conventional server board — a ~4x multiple. An NVIDIA NVL72 motherboard is reportedly **$170,000** per unit vs. ~$20,000 for traditional server boards (~8.5x). That is where Unimicron, Nan Ya PCB, TTMI and Zhen Ding capture value.
5. **The Shinko privatization removed listed supply optionality** — JIC took it out at the worst possible time for buyers and the best possible time for the remaining listed names (Ibiden, Unimicron, Nan Ya PCB), who effectively inherit pricing power as Shinko is no longer publicly accountable to grow shipments.

## Lagged comparables

- **Already ripped (the obvious winners):** ASPEED (+344% to +500% TTM), Unimicron (+726% TTM), Nan Ya PCB (+645% TTM), Ibiden (>4x off 52-wk low), TTMI (~+260% YoY).
- **Lagged comparable that finally caught up:** Nan Ya PCB lagged Unimicron through 2025 because of weaker ABF mix; Morgan Stanley's Feb 2026 dual upgrade collapsed the spread (NT$165 → NT$515 target, 113% EPS CAGR model). The mean-reversion trade against Unimicron is largely done.
- **Still somewhat lagged:** Zhen Ding (~+325% TTM) trades below sell-side consensus target — but consensus is below spot, suggesting the lag reflects a structural smartphone-flex anchor rather than mispricing.
- **The unique US play:** TTMI gets the defense + data-center double-tailwind and a US-listing premium; less of a pure substrate/ABF beneficiary than the Asian names.
- **Removed from the comp set:** Shinko (privatized March 2025).

## Risks

- **Valuation reset risk.** ASPEED trades at extreme multiples (Goldman's NT$22,000 target implies further upside but consensus 12-mo target is only NT$9,905). Unimicron P/E ~75x trailing. Nan Ya PCB has run +645% in 12 months. Any AI-capex air pocket hits these names disproportionately.
- **Capacity catch-up.** Ibiden ¥500B capex and Unimicron/Nan Ya PCB capacity additions could overshoot if hyperscaler order patterns slow. The ABF deficit narrative assumes uninterrupted 2.5–4x AI substrate area growth in two years.
- **Single-point Japan exposure.** Ajinomoto >95% of ABF and Ibiden ~50%+ of high-end FC-BGA — both Gifu/Nagano-based. Concentrated earthquake / natural-disaster tail risk.
- **BMC alternatives.** Nuvoton and in-house hyperscaler BMCs exist; ASPEED's >70% share is dominant but not absolute. A hyperscaler-led shift to integrated/custom BMCs would compress AST2700 ASP gains.
- **CCL second-order pricing.** Resonac/MGC already pushed copper-clad laminate +30%; further upstream material inflation could pressure substrate maker margins despite price pass-through.
- **Privatization precedent.** Shinko's removal from public markets reduces transparency on substrate pricing and capacity, making forecasting harder for the listed names.

## Cross-cutting links

- **K3 (Specialty materials SPOFs):** Ajinomoto ABF is the canonical SPOF; this node provides the Q3 2026 +30% price-hike confirmation referenced in K3.
- **NVIDIA-platform nodes:** Ibiden ~80% Blackwell/Rubin substrate exposure ties this node directly to the GPU roadmap node. Substrate area +80–100% per generation is the multiplier.
- **Hyperscaler ASIC nodes (Google TPU, AWS Trainium):** Unimicron captures >50% of these substrates — the ASIC theme is *additive*, not substitutive, to NVIDIA-driven substrate demand.
- **AI-server motherboard / HDI PCB:** the 20+ layer HDI / 4–8x cost-multiplier dynamic links directly to Unimicron, Nan Ya PCB, TTMI, and Zhen Ding.
- **Japan industrial-policy node:** JIC's take-private of Shinko is the most consequential semiconductor-supply-chain consolidation since the Toshiba Memory deal.

## New nodes suggested

- **Copper-clad laminate (CCL) sub-chain** — Resonac (4004.T) and Mitsubishi Gas Chemical (4182.T) pushed +30% CCL pricing in April 2026; deserves its own node alongside ABF.
- **High-speed CCL specialty suppliers** — Elite Material (2383.TW), Taiwan Union Technology (6274.TW) for low-loss laminate at >112Gbps.
- **JIC / Japan state-backed semiconductor M&A** — the Shinko take-private as the template; Rapidus, Kioxia, and JSR-equivalents.
- **BMC competitive landscape** — Nuvoton (4919.TW) as the only credible #2 to ASPEED; relevant for monopoly-erosion scenarios.

## Sources

- [Goldman Sachs Raises Aspeed Target Price for Fourth Time This Year to NT$22,000 — BigGo Finance](https://finance.biggo.com/news/IOfV_Z0BrAZSr0oSPwcf)
- [This is the ASPEED AST2700 Next-Gen BMC — ServeTheHome](https://www.servethehome.com/this-is-the-aspeed-ast2700-next-gen-bmc-arm/)
- [ASPEED Technology (TPEX:5274) — Stock Analysis](https://stockanalysis.com/quote/tpex/5274/)
- [Ajinomoto, Controlling 95% of ABF Film Market, Hikes Prices 30% — BigGo Finance](https://finance.biggo.com/news/ZU2KJZ4BpwxG186NIOsE)
- [Ajinomoto raises ABF substrate film prices 30% — Digitimes](https://www.digitimes.com/news/a20260513PD230/ic-substrate-abf-substrate-demand-substrate-2026.html)
- [Ajinomoto to Hike ABF Film Prices by 30% Amid AI Supercycle — PCSofter](https://www.pcsofter.com/news/ajinomoto-to-hike-abf-film-prices-by-30-amid-ai-supercycle-supply-demand-imbalance-to-persist-through-2027.html)
- [JPMorgan upgrades Ibiden stock to Overweight on AI substrate growth — Investing.com](https://www.investing.com/news/analyst-ratings/jpmorgan-upgrades-ibiden-stock-to-overweight-on-ai-substrate-growth-potential-93CH-4282123)
- [Bernstein upgrades Ibiden to Outperform on AI chip substrate growth — Investing.com](https://www.investing.com/news/analyst-ratings/bernstein-upgrades-ibiden-stock-to-outperform-on-ai-chip-substrate-growth-93CH-4205743)
- [Ibiden's exclusive position in AI chip substrate market rooted in deep ties with Intel — Digitimes](https://www.digitimes.com/news/a20250102PD221/ibiden-ic-substrate-demand-market-intel-nvidia.html)
- [IBIDEN Investor Relations](https://www.ibiden.com/ir/)
- [Announcement of Completion of Tender Offer for Shinko Electric — DNP](https://www.global.dnp/news/detail/20176512_4126.html)
- [JIC's acquisition of Shinko Electric delayed — MLex](https://www.mlex.com/mlex/articles/2101725/jic-s-acquisition-of-shinko-electric-to-be-delayed-due-to-ongoing-reviews-in-china-vietnam)
- [Morgan Stanley upgrades Unimicron and Nan Ya PCB on AI-led ABF substrate up-cycle — Investing.com](https://www.investing.com/news/stock-market-news/morgan-stanley-upgrades-unimicron-nypcb-on-ailed-abf-substrate-upcycle-4519224)
- [BofA Securities upgrades Unimicron to Buy on AI growth prospects — Investing.com](https://www.investing.com/news/analyst-ratings/bofa-securities-upgrades-unimicron-stock-to-buy-on-ai-growth-prospects-93CH-4398316)
- [TSMC, Unimicron Top Bernstein's Taiwan AI Exposure List — HeyGoTrade](https://www.heygotrade.com/en/news/tsmc-unimicron-bernstein-taiwan-stocks-strong-ai-exposure/)
- [TTM Technologies Q1 2026 8-K — SEC](https://www.sec.gov/Archives/edgar/data/0001116942/000119312526037560/d19660dex991.htm)
- [TTM Technologies: After Big Run, Still Has Room To Grow — Seeking Alpha](https://seekingalpha.com/article/4871332-ttm-technologies-after-big-run-still-has-room-to-grow)
- [TTMI: The Interconnect Architect of AI and Defense — Simply Wall St](https://simplywall.st/community/narratives/us/tech/nasdaq-ttmi/ttm-technologies/wqe9i60o-ttm-technologies-inc-ttmi-the-interconnect-architect-of-ai-and-defense)
- [Apple Supply Chain PCB Makers Step Up Capex With Long-Term AI Server Plans — IC-PCB](https://www.ic-pcb.com/apple-supply-chain-pcb-makers-step-up-capex-with-long-term-ai-server-plans.html)
- [Zhen Ding Technology Holding — Yahoo Finance](https://finance.yahoo.com/quote/4958.TW/)
- [Nan Ya Printed Circuit Board Corporation — Yahoo Finance](https://finance.yahoo.com/quote/8046.TW/)
- [Soaring PCB Costs & Value Transformation: AI Era — UGPCB](https://www.ugpcb.com/news/trade-news/pcb-pcba-cost-ai-server/)
- [Deconstructing AI Servers: PCB Composition and Value — Aivon](https://www.aivon.com/blog/pcb-knowledge/deconstructing-ai-servers-a-look-inside-pcb-composition-and-value/)
- [The Seasoning Company That Holds AI Chips Together — Tokyo AI Watch](https://tokyoaiwatch.substack.com/p/the-seasoning-company-that-holds)

---

## DPUs / SmartNICs

## Current state (May 2026)

The DPU (Data Processing Unit) — also called SmartNIC or IPU — is the "third chip" in every modern AI server, sitting alongside the CPU and the GPU/XPU. It offloads networking, storage, security, and east-west fabric traffic so that GPU cycles are not wasted on TCP, RDMA setup, NVMe, encryption, telemetry, or virtual-switch processing. Every NVDA HGX/DGX/GB/Vera Rubin reference platform ships with a BlueField (or, increasingly, a SuperNIC) attached. Every AWS instance type is fronted by a Nitro card. Azure is now standardizing on the Fungible-derived Azure Boost DPU. The category exists because at 400G/800G line rates a host CPU cannot keep up — the network has to terminate on dedicated silicon.

Most DPU revenue is **bundled inside parent companies' networking lines and not broken out** (NVDA, AMD, Marvell, Broadcom, Intel) or **fully captive** (AWS Nitro, Azure Boost, Google IPU). There is no pure-play public DPU stock.

**NVIDIA — the dominant merchant DPU franchise.**
- Q1 FY27 (quarter ended April 26, 2026): **Data Center networking revenue $14.8B, +199% YoY, +35% QoQ**. Data Center segment $75.2B (+92% YoY); compute $60.4B (+77%). Networking is now running at ~$60B annualized — and is the most underrated line in the print (it tripled YoY).
- The networking line bundles BlueField DPUs, ConnectX-8 SuperNICs, NVLink switch silicon, Spectrum-X Ethernet, and Quantum InfiniBand. BlueField-3 + ConnectX is multi-billion within that.
- **BlueField-4** announced (CES/GTC 2026): combines a Grace CPU + ConnectX-9 networking, **800 Gb/s throughput, 6x compute vs BF-3, supports AI factories 4x larger**. Ships in volume in H2 2026 as part of Vera Rubin platforms. Early-availability ecosystem partners: AIC, Cloudian, DDN, Dell, HPE, Hitachi Vantara, IBM, Nutanix, Pure Storage, Supermicro, VAST, WEKA.
- **BlueField-4 STX** is a reference architecture for agentic-AI storage (KV-cache offload, Dynamo integration). Tom's/SiliconANGLE/HPCwire flagged it as a category-defining product for inference-era storage.
- **ConnectX-8 SuperNIC** is the in-rack workhorse — PCIe Gen6 switching + 800G networking integrated in one device, eliminating discrete PCIe switches and doubling per-GPU network bandwidth. Detailed at Hot Chips 2025; in production in 2026 for GB300 / Vera Rubin racks.
- **DOCA** software franchise (Nvidia's DPU OS / SDK) is the moat. Storage, security, and OVS partners (VMware/Broadcom, Red Hat, Palo Alto, Cisco, Check Point, Cloudflare, Vast) build directly on DOCA — once a hyperscaler standardizes on DOCA, ripping out BlueField is expensive.
- Starting Q2 FY27 NVDA will re-segment reporting: **Data Center splits into Hyperscale and ACIE (AI Clouds + Industrial + Enterprise)**, plus Edge Computing — should improve visibility into the captive-vs-merchant networking mix.

**AMD Pensando (acquired Apr 2022, $1.9B).**
- **Salina 400** (3rd-gen, 5nm, 400 Gb/s line rate, 16 Arm Neoverse N1 cores, dual 400GbE, up to 128GB DDR5) is in volume; **Salina 400 follow-on (Pollara-class "Salina X")** is the next step toward 800G. Fully P4-programmable, backward-compatible with Elba/Capri.
- **Microsoft Azure design win is the franchise asset.** Azure "Accelerated Connections" (now in Public Preview) puts six Pensando DPUs in a smart appliance and reports a **100x improvement** in connections/sec for NVAs (firewalls, load balancers). Azure VTAP (announced at RSA 2026) runs on Pensando. Cisco's 8102-28FH-DPU-O switching platform embeds Pensando silicon and is sold into Azure.
- AMD doesn't break out Pensando revenue but it is bundled in the Data Center segment and is a meaningful part of the Cisco partnership.
- Strategically, Pensando is **the only credible merchant DPU competitor to BlueField for VMware-class east-west and zero-trust offload**, plus it has a unique "DPU in the switch" model with Cisco.

**Marvell OCTEON 10 / OCTEON Fusion.**
- OCTEON 10 (CN106): up to **24 Arm Neoverse N2 cores, inline AI/ML accelerators, integrated 1-Tbps switch, VPP hardware accelerators**. Industry-first inline ML on a DPU.
- **OCTEON 10 Fusion (CNF105)** is the dominant merchant baseband DPU for 5G/AI-RAN — sold to Samsung (lead customer), Nokia, Fujitsu, ZTE. With AI-RAN becoming an Nvidia priority, Fusion is well-positioned to ride the AI-into-telecom wave.
- **NVDA–MRVL March 31, 2026 partnership + $2B NVDA investment in MRVL.** Marvell provides custom XPUs and NVLink Fusion-compatible scale-up networking; NVDA provides Vera CPU, ConnectX, BlueField, NVLink, Spectrum-X around it. The deal explicitly cites **Aerial AI-RAN for 5G/6G** as a joint thrust — directly favorable to OCTEON Fusion.
- Marvell FY26 design wins set an all-time record; OCTEON volume is bundled in the data-center / carrier-infrastructure mix.

**Intel IPU (E2000/Mount Evans, E2100, Mount Morgan, Hot Springs Canyon).**
- E2000 was co-developed with Google Cloud and remains the DPU inside Google's **C3 VM family** (200 Gbps offload, 10x IOPS / 4x throughput when paired with Google Hyperdisk).
- **E2100** is the merchant variant (configurable 1×200GbE / 2×100GbE / 4×25GbE) — first IPU available to non-Google customers.
- **Roadmap (under NEX, not PSG):** Mount Morgan (ASIC, gen 3) and Hot Springs Canyon (FPGA) shipping 2025-2026; an unnamed **800 Gb/s gen-4 IPU targeted 2025/2026**.
- Status is fragile: Intel's overall foundry/product turnaround under Lip-Bu Tan + the loss of obvious incremental customers (AWS, Azure, Meta all in-house; Google could in-source eventually) means the IPU franchise is a watchlist item, not a growth engine. Best bull case is that Google extends the partnership through gen-4 and that enterprise OEMs (HPE/Dell) adopt E2100 as a BlueField alternative.

**Broadcom Stingray.**
- Stingray (BCM58800, 8× Arm A72 + TruFlow) had early success at Baidu — but the **follow-on Stingray 2 was reportedly cancelled** and Broadcom largely walked away from merchant DPU silicon.
- The strategic logic shifted: post-VMware acquisition, Broadcom delivers SmartNIC-class functionality to its VMware Cloud Foundation customers via **partner DPUs (BlueField, Pensando) certified through VMware vSphere Distributed Services Engine ("Project Monterey")**, plus its own NICs (NetXtreme) for the host-tier.
- AVGO's compute-offload story now runs through **Tomahawk Ultra (scale-up Ethernet)** and **Jericho3-AI** rather than a dedicated DPU SKU. Hock Tan has cited "compute offload and networking" as a growth driver but is monetizing it through switching silicon + custom XPU + VMware software, not a Stingray-3.

**Microsoft Azure Boost DPU (Fungible-derived).**
- Microsoft acquired **Fungible in Dec 2022 for ~$190M**. The team rolled into Azure infrastructure engineering.
- At **Ignite 2024**, Microsoft unveiled the **Azure Boost DPU** — Azure's first in-house DPU silicon, claiming **4x performance and 3x lower power vs current setups** for cloud-storage workloads. Co-designed with a lightweight data-flow OS, embeds compression/crypto/data-protection engines.
- Deployments are ramping through 2026. Azure now has the "processor trifecta" (CPU = Cobalt, AI = Maia, DPU = Azure Boost), plus the Azure Integrated HSM. This **partially in-houses what would otherwise have been BlueField or Pensando attach**, though Pensando still wins where merchant NVA acceleration is required.

**AWS Nitro — the captive incumbent.**
- Nitro is the original cloud DPU (2017, derived from Annapurna Labs). Every modern EC2 instance type is fronted by Nitro cards that own all networking, storage, and security.
- **Nitro v5** is in deployment. The **Trainium3 UltraServer (Dec 2025/2026)** unifies AWS silicon — Trainium3 + Graviton CPUs + Nitro cards on the same compute sled, with 3.2 Tbps per node via custom EFA networking. Graviton accounts for >50% of new CPU capacity at AWS and 98% of top-1000 EC2 customers; Nitro is the connective tissue.
- AWS continues on a roughly **2-year silicon cadence** — no pressure to release annually, which is a strategic asymmetry vs merchant vendors that must ship to sell.

**Google IPU.** Co-developed Mount Evans with Intel (still in C3); has its own custom networking silicon ("Falcon" reliable transport) increasingly used in TPU pods. Google's long-run posture is in-house, mirroring AWS.

**Smaller / FPGA-based plays.**
- **Achronix** — Speedster7t FPGAs power 400 GbE SmartNICs via the ANIC reference design (Accolade IP acquired Sept 2022). Differentiator is on-chip 2D NoC at 20+ Tbps, embedded MLPs for in-NIC ML, and partial reconfigurability (50% of fabric reserved for customer logic). Niche / telco / defense.
- **Asterfusion** (China-origin, founded 2017) — Helium SmartNIC (24-core Marvell OCTEON TX CN9670 SoC, 2×100G), ET3000A DPU appliance (48-core Marvell CN96xx). Bundles open SONiC OS + DPDK/VPP development environment. **Largely an Octeon reference platform** rather than custom silicon.
- **Napatech, Silicom, Ethernity, Kalray, BittWare, Netronome (legacy Agilio), Corigine, Yusur, Jaguar Microsystems, Nebulamatrix** — small share, mostly FPGA-based or whitebox.
- **AMD-Xilinx Alveo FPGA-based SmartNICs** (Alveo SN1000-class) — programmable, used where workloads need true bit-level flexibility (financial trading, 5G UPF, custom security). FPGA-based SmartNIC share is still the larger half of the broader SmartNIC TAM today, but DPU-based is the faster-growing half.
- **Open / OCP designs** — OCP NIC 3.0 form factor is standard; OCP has working groups on DPU manageability (RoT, telemetry). The closest thing to an "open-source DPU" is the open-firmware stack on AMD-Xilinx Alveo + OPI (Open Programmable Infrastructure) project — useful but not a real competitive threat to BlueField/Pensando.

**TAM (synthesis across analyst houses, May 2026).**
- Dell'Oro: SmartNIC market reaches **$1.6B in 2026** at 26% CAGR; ~40% of total NIC revenue by 2026 vs <20% historically; SmartNICs command **3-5x ASP** vs standard NICs.
- Polaris (DPU SmartNIC narrow definition): $1.11B in 2024 → ~14.9% CAGR through 2034.
- Verified Market Reports: $1.2B (2024) → $3.5B (2033) at 15.2% CAGR.
- Market Research Intellect: $438M (2025) → $4.07B (2035) at 25% CAGR.
- Business Research Insights (broader DPU silicon, including captive): **$4.5B in 2026 → $63.7B by 2035 at 34.2% CAGR.**
- MarketsandMarkets (most aggressive, broad SmartNIC): $1.9B (2020) → **$12.6B by 2026 at 39.5% CAGR**.
- True TAM is wider than any single number because most DPU value sits inside hyperscaler captive silicon (AWS Nitro, Azure Boost, Google IPU) and inside NVDA's bundled networking line. **Merchant-addressable DPU silicon revenue is plausibly $4-6B in 2026, on a path to $15-25B by 2030** if BlueField-4 + Pensando + OCTEON ramp into enterprise + neoclouds + AI-RAN as expected.

## Why DPUs matter for AI

1. **Every GPU cycle spent on networking is a GPU cycle not spent on tokens.** At 400G/800G line rates and trillion-parameter all-reduce traffic, host-CPU networking is not feasible. RDMA, congestion control, GPUDirect, packet spraying with reordering, in-network collectives — all live on the NIC/DPU. ConnectX-8 + Spectrum-X is the canonical example; BlueField-4 + Quantum-X is the InfiniBand equivalent.

2. **Storage offload is now the rate-limiter for inference.** Agentic AI requires KV-cache, embeddings, and long-context state to be paged between GPU HBM and flash/disaggregated memory. BlueField-4 STX is purpose-built for this; Azure Boost DPU's 4x perf / 3x lower power claim is specifically for storage workloads; Pensando is the engine in JBOF / disaggregated NVMe boxes.

3. **Security and multi-tenancy.** Zero-trust, per-VM micro-segmentation, encryption-in-flight, confidential computing attestation — all push to the DPU so that the host CPU/GPU never sees plaintext or another tenant's traffic. This is the Azure Accelerated Connections + Pensando story.

4. **Disaggregation and composability.** DPUs make CPU/GPU/memory/storage independently scalable behind a fabric — the architectural premise behind Fungible (now Azure Boost), Pensando's smart appliance model, and BlueField's storage-target product line. As AI factories scale to gigawatts, composability is the only way to keep GPU utilization above 60-70%.

5. **In-network compute and AI-RAN.** OCTEON Fusion, BlueField-4, and ConnectX-8 are increasingly running parts of the model (allreduce, softmax, prefill scheduling) or, in telecom, 5G L1 baseband processing. Nvidia–Marvell's Aerial AI-RAN deal is the wedge that brings AI compute into every cell site, and the DPU is the substrate.

## Lagged / hidden plays

- **NVDA networking line is the cleanest direct DPU exposure** but is masked by the broader GPU narrative. The $14.8B Q1 FY27 networking number (+199% YoY) is the most underrated print in 2026 semi earnings and most sell-side models still embed networking as a fraction of compute rather than as an independent franchise. The Q2 FY27 re-segmentation (Hyperscale / ACIE / Edge) will force the buyside to mark this up.
- **AMD Pensando inside AMD Data Center.** Pensando revenue is fully bundled and arguably under-credited in AMD's DC story. The Azure 100x Accelerated Connections claim is a marquee win; Cisco's 8102-DPU and 8102-DPU-O are recurring revenue. If AMD ever breaks out Pensando, the multiple should rerate.
- **Marvell custom-+-OCTEON via the NVDA NVLink Fusion deal.** Of the $2B NVDA investment in MRVL, a meaningful slice underwrites OCTEON Fusion AI-RAN and NVLink-compatible scale-up networking. MRVL's narrative is dominated by Trainium + Maia custom XPUs — OCTEON is essentially free optionality.
- **Cisco** as a back-door DPU play through the Pensando-embedded **8102-28FH-DPU-O** switching platform (Cisco effectively rebrands Pensando into the Azure motion). Also strategic against pure-merchant Arista/Broadcom in front-end.
- **HPE/Dell/Supermicro/Lenovo/Pure Storage/VAST/DDN/Weka** — every server and storage OEM monetizes the BlueField-4 STX storage attach for AI-native storage in H2 2026. These are not pure DPU plays but each ASP step-up per node is meaningful.
- **Astera Labs (ALAB) Scorpio + Aries** — while technically scale-up fabric / retimers, they perform the same offload-to-silicon role between GPU and PCIe Gen6/CXL domain that DPUs do between GPU and Ethernet/IB. Adjacent but increasingly overlapping.
- **Coherent / Lumentum / Fabrinet** — the optical interfaces on BlueField-4 + ConnectX-8 + Spectrum-X SuperNICs are all 800G / 1.6T modules; DPU volume ramps are a direct demand pull on optical TAM.
- **Israeli / EMEA engineering centers** — NVDA Mellanox (Yokneam), AMD Pensando (Haifa via acquisition history), Marvell Israel — same talent pool, hard to replicate, embedded in macro-fragility narratives but a hidden moat.
- **TSMC 5nm / 3nm packaging share** — every leading-edge DPU (BlueField-4, Salina 400, OCTEON 10) is TSMC-fabbed; advanced-node DPU volume contributes to the CoWoS-S / SoIC bottleneck story alongside GPUs.

## Risks

- **Hyperscaler in-housing.** AWS Nitro is 100% captive; Azure Boost (Fungible) is moving captive; Google has its own roadmap; Meta is custom-MTIA-centric and not a meaningful merchant DPU customer. The merchant DPU TAM ex-Nvidia depends on enterprise + neoclouds + telecom — a slower-growing pool.
- **Nvidia full-stack vertical lock-in.** DOCA + ConnectX-8 + BlueField-4 + Spectrum-X is a tightly integrated stack. If Nvidia continues to bundle networking with GPU sales, merchant DPU competitors (Pensando, OCTEON) get squeezed into the non-Nvidia 10-20% of the AI server market.
- **Software ecosystem is the moat, not silicon.** DOCA's lead is years. Anything that doesn't run DOCA needs an OPI/SONiC/OPI-Storage-equivalent stack with hyperscaler-grade reliability; no merchant alternative is there yet.
- **Roadmap execution.** Intel IPU's gen-3/gen-4 timeline has slipped repeatedly; Broadcom killed Stingray 2; Fungible was sold rather than scaled. The DPU graveyard is well-populated and the cost of one cycle slip vs Nvidia is a generation behind.
- **Power and serviceability.** SmartNICs / DPUs draw 75-150W and require BMC-grade firmware management. In gigawatt-scale AI factories this is non-trivial and any field-failure pattern becomes a procurement issue.
- **ASP compression.** Today's 3-5x SmartNIC ASP premium vs standard NICs assumes scarcity; as merchant supply catches up (2027+) and standards (UEC, OPI) commoditize the offload stack, pricing power weakens. The hyperscaler captive trend reinforces this.
- **Pure-play absence.** There is no clean public DPU stock — investors must own NVDA (where DPU is 20% of networking which is 20% of DC), AMD (where Pensando is sub-segment of DC), MRVL (where OCTEON is part of carrier+DC mix), or back-door through Cisco/HPE/Dell. That mutes any direct re-rating even when the underlying franchise inflects.
- **China.** China is the second-largest DPU market and is partially served by Asterfusion / Yusur / Nebulamatrix / Corigine — but is increasingly walled off by US export controls. BlueField-4, Pensando Salina, OCTEON 10 all face restrictions of varying severity, and the China DPU TAM is now a binary tail risk.
- **Standards drag.** UEC, OPI, OCP DPU manageability, IEEE 802.3dj — multiple parallel standards efforts. If they fragment or slip, enterprise adoption (already slower than hyperscaler adoption) stalls.

## Sources
- [NVIDIA Q1 FY27 8-K — Press Release (SEC)](https://www.sec.gov/Archives/edgar/data/0001045810/000104581026000051/q1fy27pr.htm)
- [NVIDIA Q1 FY27 CFO Commentary (SEC)](https://www.sec.gov/Archives/edgar/data/0001045810/000104581026000051/q1fy27cfocommentary.htm)
- [NVIDIA Launches BlueField-4: The Processor Powering the Operating System of AI Factories](https://blogs.nvidia.com/blog/bluefield-4-ai-factory/)
- [NVIDIA BlueField-4 with 64 Arm Cores and 800G Networking Announced for 2026 — ServeTheHome](https://www.servethehome.com/nvidia-bluefield-4-with-64-arm-cores-and-800g-networking-announced-for-2026/)
- [Nvidia launches BlueField-4 STX storage architecture for agentic AI at GTC 2026 — Tom's Hardware](https://www.tomshardware.com/tech-industry/nvidia-launches-bluefield-4-stx-storage-architecture-for-agentic-ai)
- [Nvidia introduces BlueField-4 STX reference architecture for AI storage systems — SiliconANGLE](https://siliconangle.com/2026/03/16/nvidia-introduces-bluefield-4-stx-reference-architecture-ai-storage-systems/)
- [Analysis of NVIDIA's BlueField-4 DPU and KV-Cache Context Memory Storage Platform (CES 2026)](https://www.chiplog.io/p/analysis-of-nvidias-bluefield-4-dpu)
- [NVIDIA ConnectX-8 SuperNIC PCIe Gen6 800G NIC Detailed — ServeTheHome](https://www.servethehome.com/nvidia-connectx-8-supernic-pcie-gen6-800g-nic-detailed/)
- [NVIDIA ConnectX-8 SuperNICs Advance AI Platform Architecture with PCIe Gen6 Connectivity — NVIDIA Developer Blog](https://developer.nvidia.com/blog/nvidia-connectx-8-supernics-advance-ai-platform-architecture-with-pcie-gen6-connectivity/)
- [Accelerating Microsoft Azure with AMD DPUs](https://www.amd.com/en/blogs/2023/accelerating-microsoft-azure-with-amd-dpus.html)
- [Accelerating VTAP Performance in Hyperscale Clouds with AMD Pensando DPUs (2025)](https://www.amd.com/en/blogs/2025/accelerating-vtap-performance-in-hyperscale-clouds.html)
- [AMD Pensando Salina 400 DPU: New Features and Insights Unveiled — ColoCrossing](https://www.colocrossing.com/blog/amd-pensando-salina-400-dpu-new-features/)
- [Marvell OCTEON 10 Data Processing Units](https://www.marvell.com/products/data-processing-units.html)
- [Marvell Adds Fusion Models to Octeon 10 — TechInsights](https://www.techinsights.com/blog/marvell-adds-fusion-models-octeon-10)
- [Marvell Q4 FY26 8-K (Jan 2026)](https://www.sec.gov/Archives/edgar/data/0001835632/000183563226000006/q426_8kx1312026ex-991.htm)
- [Marvell Q1 FY27 8-K (May 2026)](https://www.sec.gov/Archives/edgar/data/0001835632/000183563226000014/q127_8kx522026ex-991.htm)
- [Intel IPU E2000: A collaborative achievement with Google Cloud — Intel Tech / Medium](https://medium.com/intel-tech/intel-ipu-e2000-a-collaborative-achievement-with-google-cloud-eb1dda8c0177)
- [Intel IPU E2100 DPU Finally Launched for the Mass Market — ServeTheHome](https://www.servethehome.com/intel-ipu-e2100-dpu-finally-launched-for-the-mass-market-arm/)
- [Intel and Google Cloud jointly launch data center accelerator chip — DCD](https://www.datacenterdynamics.com/en/news/intel-and-google-cloud-jointly-launch-data-center-accelerator-chip/)
- [Broadcom Stingray SmartNIC Accelerates Baidu Cloud Services](https://investors.broadcom.com/news-releases/news-release-details/broadcom-stingray-smartnic-accelerates-baidu-cloud-services)
- [Why SmartNICs are Key in the Broadcom-VMware Deal — Futuriom](https://www.futuriom.com/articles/news/how-broadcom-could-fit-vmwares-dpu-strategy/2023/06)
- [Microsoft bolsters Azure infra with Fungible-derived DPU — Blocks & Files](https://blocksandfiles.com/2024/11/20/microsoft-boosts-azure-infrastructure-with-fungible-derived-dpu/)
- [Microsoft launches DPU and new HSM chips, also launches Azure Local — DCD](https://www.datacenterdynamics.com/en/news/microsoft-launches-dpu-and-new-hsm-chips-also-launches-hybrid-infrastructure-platform-azure-local/)
- [Azure Boost DPU: Microsoft's New Silicon Solution for Enhanced Cloud Performance — InfoQ](https://www.infoq.com/news/2024/12/azure-boost-dpu-inhouse-chips/)
- [AWS Nitro v5 Ups the Cloud DPU Game Again — ServeTheHome](https://www.servethehome.com/aws-nitro-v5-ups-the-cloud-dpu-game-again/)
- [Custom Silicon Inflection 2026 — Introl Blog](https://introl.com/blog/custom-silicon-inflection-2026-hyperscaler-asics-nvidia-gpu)
- [AWS Reaps The Benefits Of The Custom Silicon It Has Sown — The Next Platform](https://www.nextplatform.com/compute/2024/12/03/aws-reaps-the-benefits-of-the-custom-silicon-it-has-sown/1653083)
- [Arm in the agentic era: Scaling the converged AI data center — Arm Newsroom](https://newsroom.arm.com/blog/arm-rubin-converged-ai-datacenter)
- [Achronix FPGA Powered SmartNICs Push the Boundaries of Smart Networking — HPCwire](https://www.hpcwire.com/2023/10/02/achronix-fpga-powered-smartnics-push-the-boundaries-of-smart-networking/)
- [DPU & SmartNIC Vendors: Complete Product Line Guide — Cloudswit.ch](https://cloudswit.ch/blogs/the-most-complete-dpu-smartnic-vendors-with-its-product-line-summary/)
- [Asterfusion High-Performance DPU-based SmartNIC Open Source — Cloudswit.ch](https://cloudswit.ch/blogs/asterfusion-high-performance-dpu-based-smartnic-announced-open-source/)
- [Dell'Oro SmartNIC forecast: $1.6B by 2026 — Blocks & Files](https://blocksandfiles.com/2021/09/20/a-slow-burn-smartnic-sales-to-grow-to-1-5bn-plus-in-2026/)
- [DPU SmartNIC Market — Polaris Market Research](https://www.polarismarketresearch.com/industry-analysis/dpu-smartnic-market)
- [Global DPU SmartNIC Market — Market Research Intellect](https://www.marketresearchintellect.com/product/dpu-smartnic-market/)
- [Data Processing Unit (DPU) Market Report — Business Research Insights](https://www.businessresearchinsights.com/market-reports/data-processing-unit-dpu-market-120671)
- [NVIDIA and Marvell strategic partnership / NVLink Fusion / $2B investment (March 31, 2026)](https://futurumgroup.com/insights/marvell-q1-fy-2026-results-driven-by-custom-silicon-and-data-center-momentum/)

---

## Active electrical cables — Credo, Macom

## Current state (May 2026)

AECs have moved from niche workaround to a structural piece of AI rack architecture. The category sits in the 2–7m sweet spot: too long for passive DAC at 200G/lane (which tops out near 2m at 800G PAM4), too short to justify a $1k+ optical transceiver. 650 Group pegs the AEC silicon market growing ~64%/yr to ~$1B by 2028, with broader AEC cable revenue projections of $3B+ by 2026.

**Credo (CRDO)** is the pure-play winner and the only AEC story that has fully priced in.
- Stock ~$229 on May 29, 2026 ($42B market cap), +54% YTD 2026, +248% LTM. Trades at ~123x earnings.
- Q3 FY26 (qtr ended Feb 1, 2026): $407M revenue, +201% YoY, beat by ~5%. Non-GAAP gross margin 68.6%, op margin 49.6%, NI $209M.
- Q4 FY26 guide (reports Jun 1, 2026): $425–435M revenue (~153% YoY). FY26 tracking >$1.3B, ~3x FY25. Mgmt guides FY27 >50% growth.
- Customer concentration improving but still extreme: Customer A was 84% of revenue a year ago, now 48%. Three hyperscalers each >10% of revenue; a fifth hyperscaler customer just secured. Hyperscaler ~88% of total sales.
- Beat magnitude is compressing (Q1 +44%, Q3 +14%) — bar is rising into Jun 1 print.
- Roadmap: 800G AECs in volume, 1.6T AECs ramping, PCIe Gen6 AECs sampling now for H1 FY27 mass production. Optical (post-DustPhotonics $750M acquisition) expected >$500M in FY27.

**MACOM (MTSI)** is the lagged photonics/RF comparable, less AEC-centric.
- ~$375 on May 20, 2026, $28.7B mcap. +209% LTM, +32% one-month. Consensus PT $264 implies analysts see it stretched.
- FQ2 26: $289M revenue, +22.5% YoY, slight miss. FQ3 guide $331–339M.
- Data Center segment guided to +35–40% YoY for 2026. Story is 200G/lane photodetectors, CW lasers, 800G/1.6T optics — photonic ICs more than AECs proper.
- Less AEC exposure than Credo; growth slower but valuation still rich.

**Semtech (SMTC)** — CopperEdge / FiberEdge — the dark horse.
- FY26 revenue $1.05B (+15.5%); Q1 FY27 (Apr 2026) $291M, +16% YoY, beat. Adj EPS $0.51 vs $0.46 est.
- Data center business guided >50% organic growth in FY27.
- CopperEdge linear equalizers target Active Copper Cable (ACC) — pitched as 90% power reduction vs DSP-based AECs. 20+ customers in eval; initial ACC revenue Q1 FY27 with broader design wins through year.
- Demonstrated 1.6T over 3m ACC and 800G over 5m ACC into Broadcom Tomahawk 5. Live demo into NVIDIA 224G SerDes.
- Lagged on stock vs CRDO/MTSI — has not been re-rated as an AI infra play.

**Marvell (MRVL)** — AECs rolled into a much larger book.
- Alaska A 1.6T PAM4 DSP (5nm, 8x200G SerDes) is the industry's first 1.6T AEC DSP; >3m reach.
- Dec 2025 "Golden Cable" initiative — validated reference designs to accelerate hyperscaler AEC adoption via cable partners (Amphenol, FIT, Luxshare, Molex, TE, 3M, Samtec). FIT completed first design in 2 months.
- Oct 2025 added ACC linear equalizers (1.6T at 2.5W) — competitive with Semtech CopperEdge.
- AEC contribution is meaningful but invisible in headline numbers; Marvell is not a pure-play.

**Astera Labs (ALAB)** — sibling node W4 (retimers). Taurus AEC line is the overlap.
- Q1 FY26 (May 2026): $308M revenue, +93% YoY, beat. Q2 guide $355–365M vs $310M consensus.
- +227% LTM but down 31% in a recent week — extreme volatility.
- Taurus 800G AECs ramping in 2026; gross margin headwind because modules are lower margin than retimer silicon. Long-term 70% GM target.
- Aries PCIe retimers remain the core; Scorpio switch >20% of revenue.
- Architecturally, retimers and AECs converge: AECs are retimer chips packaged into cables. ALAB and CRDO are competing for the same SerDes-conditioning budget but from different starting points.

**Spectra7** — acquired by Parade Technologies (Taiwan) for $9M in 2025. Out as a public bet. Had a Tencent ACC win and 112G PAM4 GaugeChanger IP with Volex. Parade now has the IP and team.

## Where AEC sits in the stack

Physics-driven boundary, recalibrated each speed bump:
- **0–2m**: passive DAC. Cheap, zero-power. At 800G/200G-lane the reach collapses to ~2m from 3–5m at 400G because Nyquist hits ~28GHz and copper loss roughly doubles.
- **2–5m**: ACC (Active Copper Cable) — linear equalizer, no DSP, very low power (~2.5W at 1.6T). Semtech CopperEdge and Marvell ACC LE play here. Cheaper than full AECs.
- **3–7m (up to ~10m)**: AEC — full DSP-retimed copper. Credo's home turf, Marvell Alaska A, Astera Taurus, MACOM. Several hundred $ per cable but vastly cheaper than optics, ~50% lower power, claimed 1000x reliability vs optics (Credo).
- **7–100m**: AOC + short-reach optical (LPO is emerging as a low-power middle).
- **100m+**: full optical transceivers.

Each lane-rate doubling (56G → 112G → 224G PAM4) pulls the passive-copper ceiling closer and pushes AEC into links that used to be DAC. This is the secular tailwind.

**NVIDIA NVLink physical layer**: GB200 NVL72 today uses ~5,184 *passive* coax cables in 4 NVLink cartridges (Amphenol Paladin HD 224G connectors). Copper saves ~20kW per rack vs optics and costs ~1/6. Today's NVL72 is a *DAC* story, not AEC. The AEC opportunity arrives with the next generation: Rubin/Ruby-class racks scaling to 144 GPUs and 224G/lane signaling push beyond passive-copper reach. NVIDIA's stated roadmap: short-reach copper (likely AEC) + long-reach CPO, with silicon photonics commercialized ~2030. So the AEC TAM inflection inside NVIDIA racks is largely *ahead* of us, not behind.

## Lagged comparables

- **MACOM vs Credo**: MTSI is +209% LTM vs CRDO +248% — close, but MTSI's exposure is photonic ICs and 200G photodetectors, not AEC silicon. If CRDO's narrative slips on customer concentration or a guide-down, MTSI is the safer datacenter optical proxy without the pure-play premium. Analyst PTs imply MTSI is more stretched (-25% implied) than CRDO (-5%).
- **Semtech (SMTC)**: clearest lag. CopperEdge ACC is technically credible (90% power reduction claim, NVIDIA 224G interop) and FY27 data center >50% growth is guided, but the stock has not been re-rated alongside CRDO/ALAB. If ACC design wins convert to revenue in H2 FY27 as guided, this is the rerate candidate.
- **Astera Labs (ALAB)**: sibling not comp — primarily a retimer franchise. Taurus AEC is the overlap but it's margin-dilutive. ALAB rerates on PCIe Gen6 + Scorpio switch, not AECs.
- **Marvell (MRVL)**: too diversified for AEC to move the needle; useful as a Credo competitive check (Alaska A 1.6T DSP + Golden Cable ecosystem program is the direct Credo attack vector).
- **Spectra7**: gone — Parade got the IP for $9M. Watch whether Parade re-emerges as a low-cost ACC supplier into Asian hyperscalers.

## Risks

- **Customer concentration at CRDO**: still ~88% hyperscaler, top customer 48% of revenue. One air pocket from Amazon (historically the 70%+ customer) or any of the top three resets the multiple.
- **Beat magnitude compression**: CRDO's beat shrank from +44% to +14% in three quarters. Jun 1 print is the next binary event.
- **CPO / co-packaged optics**: if hyperscalers skip the 1.6T AEC generation and jump to CPO in 2027–2028, the AEC TAM curve flattens earlier than the bull case. NVIDIA targeting silicon photonics commercialization ~2030 mitigates this but doesn't eliminate it.
- **ACC eating AEC's lunch**: Semtech and Marvell ACC linear equalizers offer 90% lower power for 3–5m links. If hyperscalers accept ACC reach as good enough, full DSP AECs lose share at the short end of their range.
- **Marvell competitive response**: Golden Cable program (Dec 2025) explicitly targets hyperscaler AEC design wins with ecosystem-validated cables. Marvell's PAM4 DSP IP is mature. CRDO's reliability/power-advantage moat will be tested.
- **Custom silicon**: hyperscalers (esp. Amazon Nitro / AWS) building their own retimers / AEC silicon in-house would compress merchant share.
- **Valuation**: CRDO 123x earnings; MTSI consensus PT implies -25%. AEC story is well known; alpha is in lagged names not the leader.

## Cross-cutting nodes

- **W4 (Astera Labs / PCIe retimers)**: direct overlap via Taurus AECs; same SerDes-conditioning silicon thesis.
- **Optical transceivers / DSPs**: Credo's DustPhotonics acquisition pushes it into optical DSPs — overlaps with Marvell Inphi, MACOM, Coherent.
- **NVIDIA NVLink / Rubin roadmap**: AEC demand inflection tied to next-gen NVIDIA scale-up topologies.
- **CPO (co-packaged optics)**: AEC's long-term competitive threat — its 2028–2030 timing window defines AEC's terminal value.
- **Hyperscaler capex (Amazon/Google/Meta/MSFT/Oracle)**: AEC demand is a direct derivative of AI back-end network spend (Dell'Oro: >$100B by 2030 for AI back-end switching).

## New nodes to add

- **ACC (Active Copper Cable) as a distinct sub-category** — Semtech CopperEdge, Marvell ACC LE. Different power/cost profile than full AECs; potential to fragment the AEC TAM.
- **Marvell Golden Cable ecosystem** — could become its own node tracking validated AEC partner cables (Amphenol, Foxconn FIT, Luxshare, Molex, TE, 3M, Samtec).
- **Cable assemblers** (Amphenol, TE Connectivity, Foxconn FIT, Luxshare, Molex) — the physical-cable layer that monetizes regardless of which DSP/equalizer chip wins.
- **DustPhotonics** (acquired by Credo) — silicon photonics PIC technology, optical roadmap.
- **Parade Technologies / Spectra7 IP** — Asia-facing low-cost ACC supplier to watch.

## Sources
- [Credo Q3 FY26 earnings recap (Tickeron)](https://tickeron.com/earnings/CRDO/)
- [Credo 10-Q Jan 31, 2026 (SEC)](https://www.sec.gov/Archives/edgar/data/0001807794/000162828026014017/crdo-20260131.htm)
- [CRDO nearing 52-week high (24/7 Wall St., May 29 2026)](https://247wallst.com/investing/2026/05/29/credo-technology-nearing-52-week-high-buy-sell-or-hold/)
- [Credo Q4 FY26 preview (Yahoo Finance)](https://finance.yahoo.com/markets/stocks/articles/credo-technology-q4-earnings-investors-140900124.html)
- [Credo Q3 FY26 — revenue tripling YoY (MLQ)](https://mlq.ai/news/credo-technology-reports-q3-fiscal-2026-earnings-with-revenue-tripling-year-over-year/)
- [MACOM Q2 FY26 8-K $289M revenue](https://www.stocktitan.net/sec-filings/MTSI/8-k-macom-technology-solutions-holdings-inc-reports-material-event-a454080b09d6.html)
- [MACOM Q1 FY26 record revenue (Yahoo)](https://finance.yahoo.com/markets/stocks/articles/macom-technology-solutions-mtsi-delivered-145232373.html)
- [MACOM AI-driven guidance analysis (Simply Wall St)](https://simplywall.st/stocks/us/semiconductors/nasdaq-mtsi/macom-technology-solutions-holdings/news/what-macom-technology-solutions-holdings-mtsis-aidriven-reve)
- [Semtech Q1 FY27 blowout (ChartMill)](https://www.chartmill.com/news/SMTC/Chartmill-49058-Semtech-Corp-NASDAQSMTC-Soars-After-Blowout-Q1-Beat-and-Raised-Guidance)
- [Semtech Q4 FY26 earnings call transcript (Globe and Mail)](https://www.theglobeandmail.com/investing/markets/stocks/SMTC/pressreleases/782239/semtech-smtc-q4-2026-earnings-call-transcript/)
- [Semtech 10-Q FY26 (SEC)](https://www.sec.gov/Archives/edgar/data/0000088941/000008894126000013/smtc-20260426.htm)
- [Marvell Alaska A 1.6T PAM4 DSP for AECs](https://www.marvell.com/company/newsroom/marvell-extends-connectivity-leadership-industry-first-1-6t-pam4-dsp-active-electrical-cables.html)
- [Marvell Golden Cable initiative (Dec 2025)](https://investor.marvell.com/news-events/press-releases/detail/1002/marvell-launches-strategic-initiative-to-accelerate-aec-ecosystem-and-hyperscaler-adoption)
- [Marvell adds ACC linear equalizers (Oct 2025)](https://investor.marvell.com/news-events/press-releases/detail/996/marvell-adds-active-copper-cable-linear-equalizers-to-its-connectivity-portfolio)
- [Marvell DesignCon 2026 showcase](https://investor.marvell.com/news-events/press-releases/detail/1008/marvell-to-showcase-latest-ai-data-center-connectivity-solutions-at-designcon-2026)
- [Marvell Active Copper Cables blog](https://www.marvell.com/blogs/active-copper-cables-ai-rack-interconnects.html)
- [Astera Labs Aries PCIe retimers](https://www.asteralabs.com/products/pcie-cxl-smart-dsp-retimers/)
- [Astera Labs 227% LTM analysis (TIKR)](https://www.tikr.com/blog/astera-labs-stock-is-up-227-in-one-year-heres-whats-driving-the-rally)
- [Astera Labs PCIe/CXL scale-up bet (Substack)](https://iamfabian.substack.com/p/the-architecture-of-ai-interconnect)
- [Spectra7 acquired by Parade for $9M (eeNews Europe)](https://www.eenewseurope.com/en/spectra7-active-copper-cable-assets-sold-in-9m-deal/)
- [Spectra7 800Gbps AI server market](https://www.spectra7.com/ai-server-market)
- [NVIDIA GB200 NVL72 product page](https://www.nvidia.com/en-us/data-center/gb200-nvl72/)
- [NVIDIA GB200 OCP contribution blog](https://developer.nvidia.com/blog/nvidia-contributes-nvidia-gb200-nvl72-designs-to-open-compute-project/)
- [NVIDIA GB200 interconnect architecture (NADDOD)](https://www.naddod.com/blog/nvidia-gb200-interconnect-architecture-analysis-nvlink-infiniband-and-future-trends)
- [NVIDIA copper interconnect tech explained (DiskMFR)](https://www.diskmfr.com/nvidia-gpu-copper-cable-interconnect-technology-explained/)
- [800G AI fabric wiring guide DAC vs ACC vs AEC vs AOC (Vitex)](https://www.vitextech.com/blogs/blog/800g-interconnect-selection-guide-dac-acc-aec-and-aoc-for-ai-data-center-fabrics)
- [Navigating 800G and 1.6T connectivity](https://science-technology.news-articles.net/content/2026/05/14/navigating-the-transition-to-800g-and-1-6t-connectivity.html)
- [1.6T DAC technology analysis (C-Light)](https://m.c-light.com/news/details/1.6T_DAC_Technology_Analysis.html)
- [Rethinking 800G/1.6T interconnect power (Lintes)](https://en.lintestech.com/2026/04/28/rethinking-what-800g-and-1-6t-interconnects-consume-dac-aoc-and-lpo-as-effective-power-solutions/)

---

## Specialty alloys — Haynes, Carpenter, ATI

## Current state (May 2026)

The specialty/superalloy complex has been a quiet but explosive winner of the AI-power buildout and parallel commercial aerospace ramp. These are the picks-and-shovels feeding GE Vernova's (GEV) 100 GW gas turbine backlog and Boeing/Airbus/RTX engine production.

**Howmet Aerospace (HWM)** — the cleanest GEV-adjacent pure-play. Stock ~$254 in early March 2026, +24.6% YTD 2026 on top of a +109% one-year and +718% five-year run. 2025 sales $8.25B (up from $7.43B), operating income $2.05B, net income $1.51B. Howmet is one of only two scaled suppliers (with PCC) of the nickel-superalloy investment-cast blades and vanes that sit in the hot section of HA-class heavy-duty gas turbines. Also picked up share when PCC stumbled on production in late 2025. Bought Consolidated Aerospace Manufacturing (~$1.8B, Dec 2025) on the fastener side.

**Carpenter Technology (CRS)** — best fundamentals story in the group. ~$401 on Mar 3, 2026, +97% over 52 weeks, market cap ~$20B. FY26 operating income guide $660–700M (+26–33% YoY). Q3 FY26 (Mar-end) record $186.5M operating income (+35% YoY); SAO segment margin a record 35.6% — the 15th straight quarterly margin print up. Aerospace MRO and OEM ramp into Boeing/Airbus build rates. JPM PT $465. Quietly running a $400M buyback. Less direct GEV exposure than HWM but big aerospace + power tailwinds.

**ATI Inc (ATI)** — ~$165, large titanium/nickel franchise. 2025 revenue $4.6B (+5%), adj EBITDA $859M (+18%), FCF $380M (+53%). A&D 68% of 2025 mix, expected >70% in 2026 on mid-teens jet engine growth. Q1 2026 HPMC segment sales $614M (+5% YoY); jet engine +8%, specialty energy +26% (power tailwind showing through). Raised 2026 guidance to $1.01–1.06B EBITDA, $4.20–4.48 adj EPS. $3.7B order backlog, most shipping 2026. Also part of the US Reactor Forging Consortium (with North American Forgemasters and Scot Forge) — only fully integrated >160-ton forging capability in the Western hemisphere.

**Haynes International (HAYN)** — no longer publicly traded. Acerinox (Spain) closed the $970M ($61/share, 12.3x FY23 EBITDA) acquisition on Nov 21, 2024 via subsidiary North American Stainless. Now sits inside Acerinox's High-Performance Alloys Division alongside VDM Metals. Acerinox committed $200M in US investment, $170M into Haynes' Kokomo, IN operations. 2025 launched HAYNES 292 — gamma-prime strengthened superalloy targeting higher-temp service (turbine-relevant). The franchise is real but the public-market expression is now Acerinox (BME: ACX) — illiquid for US investors.

**Precision Castparts (PCC)** — private (Berkshire). The other half of the HA hot-section duopoly with Howmet. 2024 revenue $10.4B (+12%), pre-tax earnings ~$1.9B (+24%). 2025 operating cash flow $2.4B disclosed in BRK 2025 annual — a real recovery from Buffett's "big mistake." Capacity utilization ~90%; production hiccups in late 2025 handed Howmet share/pricing. March 2026 bought UK Morvern Group, deepening turbine casting in Europe.

**Howmet Aerospace was previously Allegheny Technologies/Alcoa spin** — current HWM is the post-2020 spin-off of Arconic into engineered structures/fasteners/airfoils. ATI Inc (the publicly traded entity) is Allegheny Technologies. They're two different things despite the name confusion.

## Linkage to turbine + nuclear ramps

**GE Vernova turbine ramp:** GEV ended 2025 with 83 GW gas turbine backlog; hit 100 GW by Q1 2026 (Q1 shipped 25 turbines, +32% YoY); targeting 110 GW combined backlog+reservations by YE 2026 and sold-out through 2030 by end-2026. 20 GW annualized production by mid-2026. Pricing +10–20% on new bids. Most orders are heavy-duty (HA-class), not aero-derivative — which maximizes superalloy content per unit. Stack on Siemens Energy + Mitsubishi Power and the global heavy-duty gas turbine cycle is a multi-year >300 GW order book against ~60 GW/yr industry capacity. **Hidden bottleneck = single-crystal nickel-superalloy blades and vanes.** The narrow funnel: PCC + Howmet for castings; Haynes/VDM/Carpenter/ATI for wrought ring/disk/case alloys; Doosan/JSW/Sheffield for the biggest forgings. Of the public US names, **HWM is the most direct GEV beta**, followed by ATI (jet engines + specialty energy), with CRS more aero-OEM levered.

**Nuclear / SMR vessel ramp:** Pressure vessel and steam-generator forging is a 5-supplier global game: Japan Steel Works (Muroran, claims ~80% historic share with 14,000-ton press), Doosan Enerbility (Korea), China First Heavy / Shanghai Electric / China Erzhong (China), Le Creusot (France/Framatome), and Russian forgemasters (Atommash, OMZ Izhora — effectively unavailable to the West). For SMRs specifically, **Doosan Enerbility** has emerged as the dominant Western-aligned vendor: forging materials for 6 NuScale upper RPVs (2000+ tons), X-energy reservation for Xe-100 components, and selected (with Škoda JS) by Rolls-Royce SMR in 2026 as dual-supply for pre-production RPV work. Aug 2025 Doosan/Amazon/X-energy/KHNP deal targets 960 MW Xe-100 capacity for Amazon AWS by 2039. Aug 2025 Fermi America deal — Doosan supplies large reactors + SMRs for 11 GW Texas "AI Campus." Doosan Enerbility (034020.KS) stock +339% one-year; HSBC initiated Buy, projects backlog triples to KRW 48.4T by 2030. Trades at expensive 2025 multiples (PE ~136x, EV/EBITDA ~28x) — the bet is on the 2030s order book, not today's earnings. **NuScale execution risk is the binding constraint** on the Doosan thesis: NuScale missed Q1 2026 revenue significantly, raising questions about cash flow breakeven by year-end.

**Hidden Western nuclear-vessel plays:** 
- **ATI Inc** — quietly a member of the US Reactor Forging Consortium (with North American Forgemasters and Scot Forge). The only Western-hemisphere >160-ton open-die / seamless rolled ring / shaped large-forging capability outside Doosan/JSW. Most underappreciated angle on the ATI story.
- **Sheffield Forgemasters** (UK MoD-owned since 2021) — surprisingly **not** chosen in the Rolls-Royce SMR dual-supply award; that went to Škoda JS + Doosan. A negative read on Sheffield's near-term commercial position.
- **JSW (5631.T)** — the incumbent heavy-forgings monopolist; Japanese listing, less actionable for many US investors.

**Titanium / VSMPO sanctions wildcard:** Russia's VSMPO-AVISMA (under Rostec, which is sanctioned, while titanium itself is not) was pre-war 60% of Airbus titanium, 80% of Boeing's. VSMPO sponge output has fallen ~32k to ~17k tonnes. Airbus down to ~20% Russian. The displaced demand is being absorbed by: ATI Titanium (US), Howmet, TIMET (US), Aubert & Duval (France, with new 60kt press for VSMPO-replacement large forgings), Osaka Titanium / Toho Titanium / ATTM (Japan, ~2x VSMPO sponge capacity combined), Kazakh suppliers, and a new BTI complex in Bahrain. Pressure for formal titanium sanctions is rising in 2025–26; if enacted, **ATI and Howmet are the most direct US beneficiaries**.

**Stork:** the originally-flagged "Hitachi 2023" acquisition is wrong — Stork (the Dutch industrial services group) was acquired by **Bilfinger** (Germany) in 2023–24, fully integrated by mid-2025. Stork does have a nuclear quality-services arm but is not a primary RPV forger and is not part of the Hitachi nuclear stack. The relevant Hitachi nuclear entity is **Hitachi GE Vernova Nuclear Energy** (renamed June 1, 2025 from Hitachi-GE Nuclear Energy), which supplies BWRX-300 components for OPG Darlington and partners with Fortum on Finland/Sweden SMR deployment.

## Lagged comparables

This cluster *has* run, but trails GEV's parabolic move and remains less crowded than the pure power names:
- GEV: +213% one-year, +29% YTD 2026
- HWM: +109% one-year, +25% YTD 2026 — closest GEV correlate
- Doosan Enerbility: +339% one-year (nuclear pure-play, KR listing)
- CRS: +97% one-year — aerospace-heavy, less turbine
- ATI: solid double-digit, less narrative-fueled than HWM, more nuclear optionality
- PCC: private inside BRK — only indirect via BRK.B (de minimis)
- HAYN: gone (Acerinox)

The "hidden" expression vs GEV at this point is **ATI** — captures jet engine ramp + specialty energy + SMR forging consortium + titanium-sanctions optionality, at a less stretched multiple than HWM or CRS. CRS has the cleanest margin trajectory but is mostly an aero MRO/OEM story. Doosan Enerbility is the highest-beta nuclear vehicle but priced for perfection and exposed to NuScale execution.

## Risks

- **Cycle peakishness:** HWM and CRS multi-baggers leave less margin of safety; commercial aerospace OEM build rates can disappoint (Boeing labor, certification).
- **Substitution / dual-sourcing:** OEMs (GEV, Siemens, MHI) actively trying to qualify additional casting and forging vendors to break PCC/Howmet pricing power; a multi-year overhang.
- **GEV ramp slips:** A real risk given the 100 GW backlog vs ~10 GW remaining 2030 capacity — but supplier slippage *reduces* deliveries, not orders, and may benefit suppliers via price/extend backlog.
- **NuScale risk to Doosan:** Q1 2026 revenue miss; if NuScale loses Amazon/KHNP confidence, Doosan's SMR forging backlog gets revalued.
- **Haynes is no longer investable as a US-listed pure-play** — only via Acerinox ADR-equivalent / Madrid listing.
- **Titanium sanctions:** binary; if Russia loophole closes, ATI/HWM/TIMET capacity becomes acutely valuable; if it stays open, less so.
- **Berkshire optionality muted:** PCC is too small inside BRK to move BRK.B meaningfully.
- **Capacity constraints on the suppliers themselves:** Howmet capacity tight; CRS executing a brownfield capex; ATI HPMC ramping — supply chain bottlenecks at *their* suppliers (rare earths, cobalt) could limit upside conversion.
- **Inventory/destock cycle in industrial gas turbines** historically vicious — though structurally different this time given AI-power demand floor.

## Cross-cutting links

- **B?? GE Vernova / gas turbine OEM ramp** — direct demand driver for HWM, PCC, CRS, ATI, Haynes/Acerinox.
- **B?? AI datacenter power demand** — root cause of the GEV backlog acceleration and Doosan SMR thesis.
- **B?? SMR / nuclear renaissance** — Doosan, ATI (via RFC), JSW, Sheffield, Škoda JS.
- **B?? Boeing/Airbus build rate recovery** — CRS/ATI/HWM commercial aerospace half of the story.
- **B?? Russia/Ukraine + sanctions regime** — VSMPO titanium loophole, ATI/HWM beneficiary.
- **B?? Berkshire Hathaway portfolio** — PCC is the under-the-radar BRK aerospace/turbine asset.

## New nodes to consider

- **Doosan Enerbility (034020.KS)** — Korean nuclear & turbine forging quasi-monopoly; cleanest SMR pressure-vessel pure-play in the West.
- **Japan Steel Works (5631.T) / Muroran heavy forgings** — historic ~80% global RPV share, less narrative-covered.
- **Acerinox (BME: ACX) / VDM Metals** — successor public vehicle for the Haynes franchise post-Nov 2024 buyout.
- **Reactor Forging Consortium (NAF + Scot Forge + ATI Forged Products)** — only Western-hemisphere >160-ton forging integrator.
- **TIMET / IperionX / titanium-sanctions beneficiaries** — second-derivative VSMPO replacement plays.
- **Aubert & Duval (Airbus/Tikehau/MBDA owned)** — French large-forge press for European titanium independence.
- **Škoda JS (CZ)** — newly Rolls-Royce SMR-selected, RPV pre-production.
- **Sheffield Forgemasters (UK MoD)** — notable for being *not* picked by Rolls-Royce SMR.
- **Hitachi GE Vernova Nuclear Energy** — BWRX-300 SMR supply chain, the actual Hitachi/GEV nuclear JV.
- **Bilfinger (BFI.DE)** — owns Stork; industrial services to nuclear / power gen.

## Sources

- [Acerinox completes Haynes International acquisition (Nov 2024)](https://www.acerinox.com/en/comunicacion/noticias/Acerinox-to-Acquire-Haynes-International/)
- [Acerinox completes acquisition of Haynes International — Channelchek](https://www.channelchek.com/news-channel/haynes-international-hayn-acerinox-completes-the-acquisition-of-haynes-international)
- [Haynes International — Grokipedia (post-acquisition profile, HAYNES 292)](https://grokipedia.com/page/Haynes_International)
- [Carpenter Technology Q3 FY2026 results (8-K)](https://www.sec.gov/Archives/edgar/data/0000017843/000001784326000018/a3rdqtrfy2026results.htm)
- [Carpenter Technology Q1 FY2026 results (8-K)](https://www.sec.gov/Archives/edgar/data/0000017843/000001784325000031/crs1stqtrfy2026resultsfinal.htm)
- [Carpenter Technology (CRS) stock overview — Simply Wall St](https://simplywall.st/stocks/us/capital-goods/nyse-crs/carpenter-technology)
- [Carpenter Technology — aerospace MRO commentary (Yahoo Finance)](https://finance.yahoo.com/news/carpenter-technology-corporation-crs-gained-121709119.html)
- [ATI Inc Q1 2026 results (8-K)](https://www.sec.gov/Archives/edgar/data/0001018963/000162828026028589/form8-kq12026ex991.htm)
- [ATI Q1 2026 slides — guidance raise (Investing.com)](https://www.investing.com/news/company-news/ati-q1-2026-slides-margin-expansion-drives-guidance-raise-93CH-4650113)
- [ATI: Structural A&D Tailwinds Set To Drive Growth In 2026 (Seeking Alpha)](https://seekingalpha.com/article/4872053-ati-structural-a-and-d-tailwinds-set-to-drive-growth-in-2026)
- [Howmet & GE Vernova up big in 2026 — 24/7 Wall St](https://247wallst.com/investing/2026/03/10/howmet-aerospace-ge-vernova-stocks-are-up-big-in-2026-extending-massive-rallies/)
- [Howmet & GE Vernova rallies — Yahoo Finance](https://finance.yahoo.com/news/howmet-aerospace-ge-vernova-stocks-162118261.html)
- [Howmet Aerospace 2025 annual report (Form ARS)](https://www.sec.gov/Archives/edgar/data/4281/000110465926039954/tm267589d2_ars.pdf)
- [GE Vernova gas turbine backlog hits 100 GW — Utility Dive](https://www.utilitydive.com/news/ge-vernova-gas-turbine-backlog-hits-100-gw-as-prices-rise/818332/)
- [GE Vernova 80 GW backlog stretching to 2029 — Utility Dive](https://www.utilitydive.com/news/ge-vernova-gas-turbine-investor/807662/)
- [GE Vernova Q1 2026 press release (8-K)](https://www.sec.gov/Archives/edgar/data/0001996810/000199681026000063/gevpressrelease1q26.htm)
- [GE Vernova HA-class gas turbines product page](https://www.gevernova.com/gas-power/products/gas-turbines/h-class-gas-turbines)
- [Gas turbine bottleneck reshaping energy infrastructure — Primary VC](https://www.primary.vc/articles/the-gas-turbine-bottleneck-reshaping-energy-infrastructure-ex8qe)
- [Precision Castparts company analysis 2026 — Aviation Outlook](https://www.aviationoutlook.com/p/precision-castparts-company-analysis-outlook-report)
- [PCC value rebound — Benzinga](https://www.benzinga.com/markets/25/03/44555517/once-called-a-big-mistake-warren-buffetts-precision-castparts-acquisition-sees-a-2-billion-rebound-narrowing-berkshire-hathaways-losses)
- [Doosan starts forging components for NuScale SMR — WNN](https://www.world-nuclear-news.org/Articles/Doosan-starts-forging-components-for-NuScale-SMR)
- [Škoda JS, Doosan Enerbility get Rolls-Royce SMR work — WNN](https://www.world-nuclear-news.org/articles/skoda-js-doosan-enerbility-get-key-rolls-royce-smr-work)
- [X-energy reserves Doosan forgings — WNN](https://www.world-nuclear-news.org/articles/x-energy-reserves-doosan-forgings)
- [Heavy manufacturing of power plants — World Nuclear Association](https://world-nuclear.org/information-library/nuclear-power-reactors/other/heavy-manufacturing-of-power-plants)
- [Doosan Enerbility 2025 SMR strategy — EnkiAI](https://enkiai.com/ai-market-intelligence/doosans-2025-smr-strategy-unveiled-for-ai-dominance/)
- [Doosan Enerbility Buy initiation by HSBC — Investing.com](https://www.investing.com/news/analyst-ratings/doosan-enerbility-stock-initiated-with-buy-rating-at-hsbc-on-nuclear-growth-93CH-4230783)
- [Calls growing for tougher sanctions on Russia's titanium — EU Reporter](https://www.eureporter.co/world/ukraine/2025/09/16/calls-growing-for-tougher-sanctions-on-russias-titanium-trade/)
- [West's titanium loophole getting harder to defend — Int'l Policy Digest](https://intpolicydigest.org/the-west-s-titanium-loophole-is-getting-harder-to-defend/)
- [Western aerospace dependence on Russian supply — Quest Metals](https://www.questmetals.com/blog/western-aerospace-s-dependence-on-russian-supply)
- [Bilfinger closes Stork acquisition](https://www.bilfinger.com/en/news/press-releases/details/successful-closing-of-stork-acquisition-strengthens-market-position-in-europe-bilfinger-continues-on-its-strategic-course/)
- [Hitachi-GE Nuclear Energy supplies OPG Darlington reactor components (May 2025)](https://www.hitachi.com/New/cnews/month/2025/05/250509.html)
- [GE Vernova Hitachi Nuclear Energy & Fortum BWRX-300 agreement](https://www.gevernova.com/news/press-releases/ge-vernova-hitachi-nuclear-energy-fortum-agreement-deployment-bwrx-300-small-modular-reactor-finland-sweden)

---

## Lagged storage — Seagate, NetApp, Pure

## Current state (May 29, 2026)

The SanDisk (+550% post-spin) and WDC (+283% in 2025) moves have re-rated the HDD/NAND complex, but the divergence inside "storage" is now huge. STX has caught up; PSTG/NTAP are the laggards relative to the pure-play HDD names — until NTAP's May 29, 2026 blowout print.

**Stock performance — 2025 full year and 2026 YTD:**

| Ticker | 2025 return | 2026 YTD (~May 28) | Notes |
|---|---|---|---|
| STX (Seagate) | ~+225% (top-5 S&P 500) | ~+190% YTD; record $843 on May 26 | Mcap ~$187B; P/E ~77; Mozaic 3 fully qualified at all targeted CSPs, Mozaic 4 qualifying at two customers; ~65% revenue from cloud |
| WDC (Western Digital) | ~+284% | ~+115% YTD | Pure-play HDD post-SanDisk spin; FY26 HDD capacity sold out; supply deals into 2027-28; ~45% LTM growth, 31% margin |
| PSTG / Everpure | flattish-to-down from Oct peak | ~flat to modestly down YTD (closed May 19 at $67.79 vs Oct 31 ATH $98.70) | Rebranded to Everpure; Meta hyperscaler deal live (1-2 EB by 2026, ~$500M FY27 royalty opp); Kioxia QLC tie-up; Q4 FY26 first $1B+ quarter (+20% YoY) |
| NTAP (NetApp) | modestly positive | ~+10% YTD pre-print → ~+57%+ after May 29 surge to $189 | Closed +32.8% on May 29 post-Q4 FY26 blowout; Q4 EPS $2.43 vs $2.27, rev $1.95B vs $1.87B; #1 all-flash share per IDC; analyst PTs (avg $117.6) still lag spot |

**Private comps re-pricing the AI-storage layer:**
- **VAST Data** — $30B Series F closed April 22, 2026 (Drive Capital + Access Industries lead, NVIDIA + Fidelity + NEA participating). >$500M committed ARR, >$4B cumulative bookings, profitable, revenue ~3x YoY. Anchor customers: CoreWeave ($1.17B multi-year), xAI Colossus (200k GPUs), USAF, Lowe's. IPO chatter for H2 2026 / 2027.
- **DDN** — $5B valuation post-Blackstone $300M (Jan 2025). Hired ex-Salesforce/Pure CRO Kevin Delane and Vice Chairman Mohsen Moazami (ex-Groq) — read as IPO prep for 2026/27. Powers >500k NVIDIA GPUs; customers include xAI, Lambda.
- **WEKA** — $1.6B (Series E May 2024, ~$425M total). No 2026 round disclosed; busy launching NeuralMesh + WEKApod, BlueField-4 partnership with NVIDIA, Scality object-tier tie-up. Stale mark, but ARR likely well above last-round basis.
- **Hammerspace** — $100M Series B (NVIDIA, Meta, SpaceX investors). Data-orchestration / Tier 0 shared storage / global namespace play sitting above arrays.
- **Cohesity/Veritas** — Cohesity closed Veritas data-protection acquisition Feb 2024; PE (Carlyle) chatter around Commvault in April 2026 suggests data-protection consolidation continuing. Rubrik (public 2024) cap ~$8.86B is the public comp.

**Dell ISG context (Q1 FY27, reported late May 2026):**
- ISG rev $29.0B (+181% YoY), AI-optimized servers $16.1B (+757%), Storage $4.3B (+8%).
- PowerStore: 8 straight quarters of double-digit demand growth.
- PowerScale + ObjectScale: 3 consecutive quarters of growth, double-digit last 2.
- AI backlog $51.3B; $24.4B AI orders in Q1; FY27 AI server guide raised to $60B.
- Takeaway: Dell storage is finally growing again under AI lift, but rev growth is dwarfed by AI servers — storage is a margin story inside Dell, not a stock catalyst.

**Marvell as storage-controller proxy:**
- FY26 rev $8.195B (+42% YoY); Q1 FY27 $2.418B (+28%), Q2 guide $2.7B (+35%).
- March 2026: NVIDIA $2B investment + NVLink Fusion partnership (custom XPUs + scale-up networking).
- Acquired Celestial AI (Feb 2, 2026) and XConn (Feb 10, 2026) — pivoting to optical/CXL fabric. SSD-controller franchise (Bravera PCIe Gen5) is real but de-emphasized in the AI narrative; data-center segment is the lift.

## Why these may lag or catch up

**Why STX caught up to WDC (and arguably overshot):**
1. HAMR/Mozaic 3 qualification cleared the risk overhang — Mozaic 3 fully qualified at all targeted CSPs by mid-2026; Mozaic 4 already in qual at two customers.
2. Cloud now ~65% of revenue — re-rating from cyclical HDD to AI infrastructure name.
3. Nasdaq-100 inclusion in 2025 drove forced index buying.
4. Sell-side pile-in: Evercore, Rosenblatt, Barclays at $1,000 PT; BofA $900; TD Cowen $850. P/E of 77 leaves no margin of error.

**Why PSTG has lagged (the real laggard story):**
1. The Meta deal was disclosed Dec 2024 / Mar 2025 — already in the stock. Stock peaked at $98.70 Oct 31, 2025 and has roundtripped to mid-$60s/low-$70s.
2. Kerrisdale Capital short thesis (Sep 2025): Meta engineers reportedly view QLC as not yet price-competitive vs HDD for broad deployment; engagement hasn't expanded to other Meta data centers; "capabilities are narrow and replicable."
3. QLC margin drag: product GM only 67% YTD FY26 vs targeted 70%, due to QLC component costs.
4. Rebrand to "Everpure" — typical late-cycle move that buy-side has historically read skeptically.
5. But: Q4 FY26 first $1B+ quarter (+20% YoY) and royalty stream (>90% GM) starts to scale FY27. Avg PT $89.89 suggests ~30% upside if Meta volume materializes.

**Why NTAP lagged then ripped:**
1. NTAP was treated as legacy enterprise NAS / not an AI name — 52-wk low of $93.23 on May 9, 2025.
2. FY26 quarterly cadence built the case: Q2 AFA +9% YoY to $1.0B, public cloud +32%; Q3 AFA +11% to record $1.0B, billings +10% (9th straight growth qtr).
3. May 29, 2026: Q4 beat ($2.43 vs $2.27, $1.95B vs $1.87B) + Q1 guide $2.05-2.15 EPS / $1.75-1.90B rev well above Street → +32.8% in a single day to $189.
4. Re-rating from NAS dinosaur to "intelligent data backbone for AI" — but P/E ~30 and avg analyst PT $117.6 implies the move is fully priced (or sell-side hasn't caught up — note BofA only nudged to $125, Wedbush stays at $115 Neutral).

**Where catch-up may still live:**
- VAST/DDN/WEKA pre-IPO marks. VAST tripled valuation in <2.5 years; DDN IPO 2026/27.
- Cohesity (private) and Veeam are the obvious next public comps if Rubrik holds at $8.9B.
- Hammerspace orchestration layer if AI data-pipeline complexity outgrows array-level solutions.
- Marvell custom-SSD-controller franchise rarely talked about but feeds the QLC stack PSTG/Meta and hyperscalers run on.

## Specific divergences

**STX vs WDC:** WDC won 2025 (+284% vs STX +225%) on the SanDisk spin clarity + sold-out HDD capacity. STX won 2026 YTD (+190% vs WDC +115%) on HAMR qualification milestones. Both now trade at premium multiples (WDC ~35x fwd P/E vs 5-yr avg 19.5x; STX P/E 77). The pair-trade has narrowed materially; from here, news flow on Mozaic 4 ramp and CSP ASP discipline drives relative.

**PSTG vs Dell PowerScale:** Pure's Meta licensing model (~$500M FY27 royalty opp) is the higher-multiple story but unproven at scale. Dell's PowerScale grew double digits in Q1 FY27 but is buried inside a Storage segment growing 8% inside an ISG segment growing 181% — no separate disclosure, no separate stock. The market is paying ~$20B for PSTG's QLC narrative and ~zero for Dell's PowerScale franchise.

**Public HDD/NAND vs private AI-storage:** VAST $30B private mark is roughly 1/6 of STX's $187B mcap on >$500M ARR vs STX's ~$10B+ revenue run-rate. The private comps are getting paid for growth (3x YoY), the public names for AI exposure + buybacks/dividends. If VAST IPOs at >$30B that becomes the new anchor for PSTG/NTAP multiples.

**NTAP vs PSTG before May 29:** NTAP lagged badly in 2025 and YTD 2026 vs PSTG, then leapfrogged in a single session. Both are now enterprise-AI storage stories — PSTG with the hyperscaler call option, NTAP with the bigger installed base, cleaner margin profile (70-71% GM, 28-29% non-GAAP op margin), and proven cloud-native partnerships.

**Marvell vs pure storage controller:** No public pure-play NAND-controller name; Silicon Motion is closest. Marvell's SSD-controller revenue is buried inside data-center; the AI narrative is now NVLink Fusion + Celestial AI optical + custom XPUs. Storage controllers are a quiet beneficiary, not a stock catalyst.

## Risks

- **Cyclical reversal:** HDD/NAND has always been brutally cyclical. If hyperscaler capex digests in 2H26/2027, STX/WDC at P/E 35-77 have no support.
- **PSTG Meta deal stalls:** If Kerrisdale is right that QLC isn't price-competitive and Meta doesn't expand beyond initial DC, PSTG re-rates back to legacy enterprise-AFA multiple.
- **NTAP post-print disappointment:** Stock at $189 with avg analyst PT $117.6 — implies sell-side either chases or fades. Memory cost inflation is a stated risk for margins.
- **VAST/DDN IPO indigestion:** Multiple private AI-storage IPOs in 2026-27 could pressure public-name multiples by giving buyers higher-growth alternatives.
- **Hyperscaler in-house storage:** AWS, Google, Meta all have internal storage stacks. Pure's Meta win is the exception, not the rule.
- **Dell storage perpetual underperform:** PowerScale growth is real but the ISG segment optics will always favor servers. Hard to get paid as a Dell-storage long.
- **Rebrand red flag:** Pure → Everpure is the kind of late-cycle move that historically marks a top in the underlying business.

## Cross-cutting

- Ties to **B7 NAND/memory** (Kioxia-Pure QLC tie-up; SanDisk +550%; broader NAND ASP cycle).
- Ties to **datacenter capex** node — storage capex follows GPU capex with a 1-2 quarter lag; recent prints suggest the lag is compressing.
- Ties to **hyperscaler** node — Meta titan clusters (Prometheus/Hyperion) are the PSTG demand backbone; xAI Colossus is the VAST demand backbone.
- Ties to **inference** node — inference-driven token generation expands hot-data tier (flash) demand; HDD remains cold/nearline.
- Ties to **AI-native infra (CoreWeave/Lambda neoclouds)** — VAST/WEKA/DDN are their default storage stacks.

## New nodes to consider

- **VAST Data IPO watch (2026-27)** — pre-IPO anchor for AI-storage multiples.
- **DDN IPO watch (2026-27)** — second AI-storage IPO; Blackstone-backed.
- **Data orchestration layer (Hammerspace, Komprise, Arcitecta, Data Dynamics)** — above the array, below the GPU; unstructured-data control plane.
- **Cohesity/Rubrik/Veeam data-protection consolidation** — Carlyle/PE chatter around Commvault April 2026 suggests next leg.
- **Storage controllers (Marvell, Silicon Motion, Phison)** — hidden NAND/SSD pick-and-shovel.
- **Dell ISG storage breakout** — if Dell ever discloses PowerScale separately, it becomes a comp.

## Sources
- [Seagate $843 record May 26 2026, Wall Street $1,000 targets](https://www.mexc.com/news/1113525)
- [Seagate +190% YTD 2026; cloud 65% of revenue; Mozaic 3 fully qualified](https://parameter.io/seagate-stx-stock-soars-past-843-wall-street-sets-1000-price-targets/)
- [Seagate +225% in 2025; top-5 S&P 500](https://www.tikr.com/blog/why-is-seagate-nasdaq-stxstock-up-225-in-2025)
- [WDC +283.79% total return 2025; +115% in 2026; HDD capacity sold out through 2027-28](https://www.tikr.com/blog/western-digital-stock-is-up-115-in-2026-heres-whats-driving-the-rally)
- [STX vs WDC fundamentals comparison May 2026 (Trefis)](https://www.trefis.com/articles/600022/seagate-technology-vs-western-digital-which-stock-could-rally-4/2026-05-21)
- [PSTG Meta hyperscaler deal, 1-2 EB by 2026, $500M FY26 royalty opp](https://www.tipranks.com/news/ratings/pure-storages-strategic-positioning-and-hyperscale-win-with-meta-drive-buy-rating)
- [PSTG Kioxia QLC tie-up and Q3 beat-and-raise](https://stocktwits.com/news-articles/markets/equity/pure-storage-reports-beat-and-raise-q3/cJ98zaKRhu)
- [Kerrisdale Capital short report on Pure Storage / Everpure](https://www.kerrisdalecap.com/wp-content/uploads/2025/09/PSTG-Kerrisdale.pdf)
- [PSTG ATH $98.70 Oct 31 2025; rebrand to Everpure; recent prices $62-77](https://www.macrotrends.net/stocks/charts/PSTG/pure-storage/stock-price-history)
- [NTAP +32.8% on May 29 2026 to $189; Q4 FY26 beat and Q1 guide](https://www.timothysykes.com/news/netapp-inc-ntap-news-2026_05_29/)
- [NTAP Q3 FY26 record AFA, 11% AFA growth, 9 straight quarters billings growth](https://www.sec.gov/Archives/edgar/data/0001002047/000119312526076545/ntap-ex99_1.htm)
- [VAST Data $30B Series F April 22 2026; NVIDIA/Drive Capital/Access](https://www.vastdata.com/press-releases/vast-series-f-financing-at-30-billion-valuation)
- [VAST $4B cumulative bookings; >$500M ARR; CoreWeave $1.17B contract](https://www.blocksandfiles.com/flash/2026/03/11/vast-data-raises-1b-at-30b-valuation-as-ai-storage-demand-surges/5208106)
- [DDN $5B valuation Blackstone $300M; IPO hire signals](https://news.crunchbase.com/ai/pe-data-storage-ddn-blackstone/)
- [DDN VP Chairman appointment as IPO signal Feb 2026](https://www.blocksandfiles.com/ai-ml/2026/02/05/ddn-appoints-vice-chairman-amid-enterprise-ai-expansion/4090500)
- [WEKA $1.6B Series E May 2024; no 2026 raise disclosed](https://www.weka.io/company/weka-newsroom/press-releases/weka-nets-140m-in-series-e-funding-at-1-6b-valuation/)
- [Hammerspace $100M Series B; NVIDIA/Meta/SpaceX investors](https://www.datacenterfrontier.com/machine-learning/article/55290003/hammerspace-raises-the-bar-for-ai-and-hpc-data-center-infrastructure)
- [Dell Q1 FY27: ISG $29B +181%, Storage $4.3B +8%, AI servers $16.1B +757%, AI backlog $51.3B](https://www.sec.gov/Archives/edgar/data/0001571996/000157199626000021/exhibit991earnings8kq1fy27.htm)
- [Dell PowerScale/ObjectScale 3 quarters double-digit growth](https://futurumgroup.com/insights/dell-q4-fy-2026-earnings-highlight-ai-optimized-server-ramp/)
- [Marvell FY26 $8.195B +42%; NVIDIA $2B investment + NVLink Fusion partnership Mar 2026](https://www.sec.gov/Archives/edgar/data/0001835632/000183563226000006/q426_8kx1312026ex-991.htm)
- [Marvell Celestial AI + XConn acquisitions Feb 2026](https://www.sec.gov/Archives/edgar/data/0001835632/000183563226000014/q127_8kx522026ex-991.htm)

---

## Lagged utilities — PSEG, DUK, SO, EXC

## Current state (May 2026) + stock returns

Constellation Energy (CEG) ran from ~$200 (early 2024) to an all-time high of **$402.32 on Oct 15, 2025** on the AI/nuclear thesis (TMI restart for Microsoft, hyperscaler PPA optionality, Calpine deal). It has since pulled back hard: **~$289 as of May 29, 2026, down ~14% YTD 2026 and ~28% off its high**, hit by softer 2026 EPS guidance ($11.00–$12.00 vs Street $11.72), Crane (TMI) restart delays, and Calpine integration costs. Even with the pullback, CEG remains the benchmark on which the rest of the regulated/nuclear-exposed universe is judged.

The "lagged utilities" basket — all with material nuclear or data-center exposure but trading far behind CEG over the 1-yr / 18-mo window:

- **PSEG (PEG)** — ~$79.51 (May 25, 2026), near 52-wk **low of $76.05** (52-wk high $91.26). 1-yr total return roughly flat to slightly negative, underperforming the US Integrated Utilities industry (+9.6%) and the broad market (+14.9%). Owns Salem 1+2 and Hope Creek = **3,758 MW of NJ/PA nuclear**, ran 92.4% capacity factor, cleared 3,500 MW at $329/MW-day in PJM's July 2025 auction. Reaffirmed 2026 guidance $4.28–$4.40 EPS, 6–8% long-term growth, $24–28B 2026–30 capex. Jefferies downgraded to Hold May 2026 citing "reduced confidence on existing nuclear plant data center deals."
- **Duke Energy (DUK)** — ~$122.73 close May 29, 2026 (52-wk high $134.49 in March 2026, low $111.22 mid-2025). **~+7% YTD 2026, ~+11.7% 1-yr**. Beta 0.5. 11 GW operating nuclear (Catawba, McGuire, Brunswick, Harris, Oconee, Robinson). Signed >4.5 GW (some reporting 7.6 GW) of executed hyperscale data-center service agreements in NC/SC. $103B 5-yr capex plan, +14 GW generation by 2030, early-site permit for new nuclear at Belews Creek, Robinson SLR through 2050.
- **Southern Company (SO)** — ~$91.42 late May 2026. Modest 2026 YTD performance; significantly underperformed S&P 500 and XLU over the past year despite owning **Vogtle 3+4 (2.2 GW new nuclear, the only new US units in decades)** plus Plant Hatch and Farley. Atlanta is one of the fastest-growing DC markets (Google, Microsoft, Meta, AWS). 75 GW load pipeline, $81B 5-yr capex (2026–30), 2026 EPS guide $4.50–$4.60.
- **Exelon (EXC)** — ~$45.51 late May 2026. EXC is the **T&D-only stub** left after the 2022 Constellation spin (i.e., it explicitly sold its nuclear upside to what is now CEG). ComEd northern Illinois territory seeing **~26% CAGR data center load**, 19 GW pipeline (~45% under Transmission Security Agreements), $41.3B base plan + $12–17B identified incremental transmission. 2026 EPS guide $2.81–$2.91, 5–7% EPS CAGR through 2029. Citi PT $58 (~22% upside).

The other names tied to this lens:

- **Dominion (D)** — ~$66, **+5% YTD 2026**, market cap ~$56B. Already in U1. Catalyst: **NextEra all-stock takeout announced May 18, 2026** (0.8138 NEE/D, ~$67B). 20+ GW signed ESAs in N. Virginia, 5.4% weather-normalized VA sales growth in 2025, all 20 record peak-demand days in last 14 months. Mizuho PT raised to $72.
- **Entergy (ETR)** — ~$112 (May 7, 2026), **+20% YTD, ~+31% 1-yr, ~+41% TSR 1-yr**. The standout laggard-no-more: **March 2026 $15B Meta Louisiana deal** (often referred to as Hyperion / Hyperion-class campus — Meta's Hyperion is a Louisiana, not Mississippi, project; Mississippi sees ~$2B+ customer savings flow-through). 5 nuclear units (Grand Gulf, River Bend, Arkansas Nuclear One 1+2, Waterford 3 — Indian Point is retired). $57B 4-yr capex plan (+30% vs 3 months earlier), 7–12 GW DC pipeline. Jefferies: "best way to invest in data centers" in its utility coverage; ~13% upside to Street estimates.
- **AES Corp (AES)** — high-yield (~4.3%), ~12 GW PPA backlog with 85% online by end-2027; Google top corporate buyer 2025, Amazon Bellefield 2 GW solar+storage, Meta-linked 650 MW. Feb 2026 landmark Google Wilbarger County TX deal (20-yr PPAs). Stock up ~47% 1-yr off lows, ~12% YTD. Ranked #1 corporate clean-energy seller in Americas (BNEF, 5th year). Pure DC-renewables play, no nuclear.
- **NRG Energy (NRG)** — ERCOT+PJM merchant/retail. Raised 2026 EBITDA guide $5.325–5.825B on data-center demand; added 150 MW (Q3'25), 445 MW total DC retail with one counterparty. Sept 2025 TEF $562M 3% loan for Cedar Bayou 689 MW. Morgan Stanley PT $159 (Equal Weight). Stock up materially on DC story.
- **Sempra (SRE)** — ~$90 (May 28, 2026), 52-wk high $97.44 Feb 2026. Stock dropped 19% on the Dec 2025 / Feb 2026 reset (CA regulatory + spending), now rebuilding. $65B 2026–30 capex (+$9B optional). **Oncor (TX) 127 GW substantiated qualifying load — 102.22 GW large-load + 5.2 GW medium-load**, 384 DC requests in TX. 2026 EPS guide $4.80–$5.30; 2030 EPS $6.70–$7.50. KKR buying 45% of Sempra Infrastructure (LNG) for $10B (close Q2–Q3 2026). Bull case PT $163 (~76% upside).

## Why CEG ran and these didn't

1. **Merchant vs regulated economics.** CEG sells nuclear MWh into PJM and direct to hyperscalers at *market* prices — every $/MWh of premium flows to EPS uncapped. PSEG, DUK, SO are predominantly regulated: nuclear output goes into the *rate base* at allowed ROEs (~9–10%). A $329/MW-day PJM capacity print or a hyperscaler PPA at $80+/MWh creates dramatically less EPS torque for a regulated owner — and what upside exists often must be shared with ratepayers via NJ BPU / NCUC / GA PSC review.
2. **CEG is the only "pure" listed nuclear story.** Post the 2022 Exelon spin, CEG = ~21 GW nuclear baseload + (post-Jan 2026) Calpine's ~35 GW gas/geo. EXC kept only T&D. There is no other US-listed pure nuclear comp; passive AI/nuclear flows concentrated in CEG.
3. **Restart optionality.** TMI/Crane (835 MW, Microsoft-backed, $1B DOE loan, target mid-2027) and additional Calpine + nuclear uprate growth gave CEG a tangible "new MW" story. PSEG's Salem 200 MW uprate is 2027–29; DUK's Belews Creek new nuclear is early-stage; SO's Vogtle 3+4 came online *before* the AI rerating and is already in the rate base.
4. **State / regulatory frictions.** NJ lacks the DC tax incentives VA/TX/OH have, so PSEG's pipeline (~9–11 GW) plateaued and "data center development in PSE&G's service territory hasn't included large hyperscaler projects." Jefferies' May 2026 downgrade explicitly cited reduced confidence on PSEG existing-nuclear DC deals.
5. **FERC colocation overhang.** The FERC order forcing PJM to write colocation rules is a *positive* for nuclear/gas owners but creates allocation/timing uncertainty (PJM 2031 eligibility cap on backstop auction, unresolved cost-shift to non-hyperscaler ratepayers) — markets won't pay full CEG-style multiple until rules land.
6. **Rate-base equity issuance dilution.** DUK ($103B), SO ($81B), Dominion ($65B), Sempra ($65B), Entergy ($57B), PSEG ($24–28B) all need to fund DC-driven capex, much via equity issuance. This caps near-term EPS torque.
7. **Dominion is the exception that proves the rule:** rerated only on the NEE takeout, not on the underlying Loudoun DC story alone.

## Catalysts for re-rating each

- **PSEG (PEG):** (a) any hyperscaler PPA *announcement* against the 3,758 MW NJ nuclear fleet — Jefferies notes deals have not materialized; (b) NJ BPU business-model review outcome (mid-2026); (c) Salem 200 MW uprate confirmation 2027–29; (d) PJM 2027/28 base auction prints; (e) NJ state DC tax incentives matching PA/OH/VA.
- **Duke Energy (DUK):** (a) conversion of the 7.6 GW "executed" pipeline into in-service load; (b) Belews Creek early site permit + new nuclear FID; (c) Robinson 20-yr SLR through 2050 monetization; (d) Carolinas merger synergy realization; (e) NC/SC IRP order constructive on DC cost allocation.
- **Southern (SO):** (a) Vogtle 5+6 / new SMR announcement (only US utility with recent EPC track record); (b) Georgia Power 2028 base-rate reset; (c) further $25B+ capex uplift if GA load tops 10 GW; (d) hyperscaler direct Vogtle PPA / behind-the-meter deal.
- **Exelon (EXC):** (a) constructive PA rate case 2027; (b) IL ComEd transmission projects materializing into the $12–17B incremental bucket; (c) any FERC ruling that lets EXC charge premium tariffs for DC-driven transmission; (d) 19 GW pipeline conversion rate. Note: EXC has *no nuclear*, so the only path is T&D rate-base growth — no CEG-style re-rate possible.
- **Dominion (D):** Closure of NEE deal (regulatory approval timeline could stretch into 2027); CVOW completion (2027); SCC outcome on DC cost-allocation rules.
- **Entergy (ETR):** Already partially rerated. Watch: Meta Louisiana ramp, additional 7–12 GW DC pipeline conversion, Grand Gulf / ANO uprates, possible hyperscaler nuclear PPA.
- **AES:** Continued Google/Amazon/Meta PPA cadence; balance-sheet deleveraging; any take-private speculation given depressed multiple vs renewables-DC peers.
- **NRG:** Cedar Bayou COD (mid-2028); additional ERCOT/PJM DC retail wins; LS Power integration synergies.
- **Sempra:** Oncor 127 GW load conversion (every 20 GW = ~$17B incremental rate base per analyst math); LNG sell-down close Q2–Q3 2026 funds growth without equity; Texas-specific multiple expansion.

## Cross-cutting themes

- **Merchant > regulated for AI/nuclear torque.** CEG, NRG, and to a lesser extent AES capture price uplift directly; regulated names share with ratepayers.
- **PJM is the key clearing venue.** $61 (2024/25) → $270 (2025/26) → $329 (2026/27) capacity prints are the single biggest tailwind to PSEG, EXC (via ComEd), DUK (Indiana side), Dominion.
- **Nuclear restart optionality is the asymmetric trade.** TMI/Crane (CEG) and Palisades (Holtec) are the templates; PSEG Salem uprate, Duke Belews Creek, and any SMR FID at Vogtle would be analogous catalysts.
- **State DC tax/incentive regime drives where load lands.** VA, TX, OH winning; NJ, NY structurally disadvantaged. This shapes which utility actually books the gigawatts.
- **FERC colocation rulemaking** is a 2026–27 catalyst for every nuclear owner.

## New nodes to add

- **B9.1** — PJM capacity auction trajectory ($61 → $329/MW-day) and which utilities lever which assets.
- **B9.2** — FERC colocation rulemaking — winners (nuclear/gas IPPs) vs losers (existing ratepayers).
- **B9.3** — Nuclear restart / uprate pipeline (TMI, Palisades, Duane Arnold, Salem uprate, Vogtle SMR, Belews Creek, ANO uprate).
- **B9.4** — NEE / Dominion merger arb + utility M&A wave (does SO, DUK become a target?).
- **B9.5** — State-level DC tax incentive comparison (VA, TX, GA, OH, IL vs NJ, NY, CA).

## Risks

- **CEG pulls back further** (already down 28% from high); a lower CEG multiple compresses the entire comp set rather than dragging laggards up.
- **Hyperscaler capex pause** (any pullback in Microsoft/Meta/Google/AWS DC spend invalidates the entire thesis).
- **Regulatory backlash on cost allocation.** VA SCC, NJ BPU, IL ICC tightening DC cost rules would cap rate-base growth.
- **Equity-issuance dilution** at DUK, SO, D, ETR, SRE to fund $50–100B+ capex plans.
- **PJM colocation rules end up less favorable than nuclear bulls expect** (cost-shift to hyperscalers explicit, narrower colocation eligibility).
- **Interest-rate sensitivity.** Long-duration utility cash flows discounted at higher rates if 10-yr UST stays above 4.5%.
- **PSEG NJ-specific:** NJ BPU rate-relief pressure under new governor, NRC review overhang on Salem/Hope Creek.
- **Vogtle execution risk on any new nuclear announcement** (the original Vogtle 3+4 was 7 years late and ~$30B over budget).
- **NEE/D deal break risk** (length of regulatory approval, ratepayer-advocate opposition).
- **Entergy:** Meta deal scope reduction or LA PSC unfavorable rate treatment of $15B investment.

## Sources

- [CEG: Constellation Energy stock down 20% in 2026 / TIKR](https://www.tikr.com/blog/constellation-energy-stock-is-down-20-in-2026-heres-what-12-annual-returns-could-mean)
- [CEG: Buy the pullback before data center deals arrive / Seeking Alpha](https://seekingalpha.com/article/4910051-constellation-energy-buy-the-pullback-before-data-center-deals-arrive)
- [CEG 8-K Q4 2025 / SEC](https://www.sec.gov/Archives/edgar/data/0001868275/000186827526000029/ceg-20260224991.htm)
- [CEG: stock historical prices / Macrotrends](https://www.macrotrends.net/stocks/charts/CEG/constellation-energy/stock-price-history)
- [PSEG: How PSEG is becoming an AI infrastructure play / Seeking Alpha](https://seekingalpha.com/article/4888651-public-service-enterprise-group-how-pseg-is-becoming-an-ai-infrastructure-play)
- [PSEG: 2025 results announcement / PSEG IR](https://investor.pseg.com/investor-news-and-events/financial-news/financial-news-details/2026/PSEG-ANNOUNCES-2025-RESULTS/default.aspx)
- [PSEG: $26B capital plan / TIKR](https://www.tikr.com/blog/public-service-enterprise-group-stock-can-a-26-billion-capital-plan-deliver-more-returns-in-2026)
- [PSEG: Q1 2026 earnings call coverage / BigGo](https://finance.biggo.com/news/US_PEG_2026-05-05)
- [PSEG CEO: NJ nuclear outlook improves / Utility Dive](https://www.utilitydive.com/news/pseg-nuclear-new-jersey-earnings/819444/)
- [PSEG could offer lower rates to NJ governor / Utility Dive](https://www.utilitydive.com/news/pseg-rates-new-jersey-sherrill-earnings/804853/)
- [Duke Energy: targets data center load growth / Yahoo](https://finance.yahoo.com/sectors/energy/articles/duke-energy-targets-data-center-131447830.html)
- [Duke Energy: 2026 proxy / Stocktitan](https://www.stocktitan.net/sec-filings/DUK/def-14a-duke-energy-corp-definitive-proxy-statement-15edb3374c7b.html)
- [DUK stock forecast May 2026 / MEXC](https://blog.mexc.com/finance/duk-stock-forecast-2026/)
- [Southern Company: AI utility / FinancialContent](https://markets.financialcontent.com/stocks/article/finterra-2026-2-19-the-ai-utility-southern-company-so-and-the-new-energy-tsunami)
- [Southern Company: Vogtle and AI / PitchGrade](https://pitchgrade.com/research/southern-company-ai-margin-pressure)
- [Southern Company: nuclear-powered engine of southeast AI boom / FinancialContent](https://markets.financialcontent.com/stocks/article/finterra-2026-2-20-southern-company-nyse-so-the-nuclear-powered-engine-of-the-southeasts-ai-boom)
- [Exelon Could Reach $58 by End of 2026 / 24/7 Wall St](https://247wallst.com/investing/2026/03/26/exelon-could-reach-58-by-end-of-2026-as-ai-data-center-demand-fuels-26-load-growth-in-illinois/)
- [Exelon 8-K Q1 2026 / SEC](https://www.sec.gov/Archives/edgar/data/0001109357/000110935726000061/exc-20260506ex991.htm)
- [DUK vs EXC analysis / Nasdaq](https://www.nasdaq.com/articles/duke-energy-vs-exelon-which-power-utility-stock-offers-more-upside)
- [Entergy Meta deal $15B Louisiana / FinancialContent](https://markets.financialcontent.com/stocks/article/finterra-2026-3-30-the-utility-renaissance-how-entergy-etr-is-powering-the-ai-future-via-the-meta-grid-deal)
- [Entergy $57B capital plan Meta / Utility Dive](https://www.utilitydive.com/news/new-generation-adds-12b-entergy-capital-plan/818790/)
- [Entergy Meta deal Jefferies / Yahoo Finance](https://finance.yahoo.com/markets/stocks/articles/assessing-entergy-etr-meta-data-231120619.html)
- [Jefferies on Entergy Meta expansion / Investing.com](https://www.investing.com/news/analyst-ratings/jefferies-reiterates-entergy-stock-rating-on-meta-data-center-expansion-93CH-4585687)
- [AES Corp: data center pivot / ad-hoc-news](https://www.ad-hoc-news.de/boerse/news/ueberblick/energie-aes-corp-s-data-center-pivot-could-drive-renewable-surge/69164853)
- [AES recognized by BNEF as top clean-energy supplier / Stocktitan](https://www.stocktitan.net/news/AES/aes-recognized-by-bnef-as-top-provider-of-clean-energy-to-o8drs4fsk53d.html)
- [AES: pioneering renewable transition for DC giants / Ainvest](https://www.ainvest.com/news/aes-corporation-pioneering-renewable-energy-transition-data-center-giants-2506/)
- [NRG: Data center growth lifts Texas outlook / Insider Monkey](https://www.insidermonkey.com/blog/data-center-growth-lifts-nrgs-texas-outlook-and-2026-profit-targets-1669598/)
- [NRG 10-Q Q1 2026 / SEC](https://www.sec.gov/Archives/edgar/data/0001013871/000101387126000012/nrg-20260331.htm)
- [NRG: structurally tight power market / Seeking Alpha](https://seekingalpha.com/article/4845526-nrg-energy-stock-buy-into-structurally-tight-power-market-and-data-center-super-cycle)
- [Sempra: $56B capital plan Texas / Utility Dive](https://www.utilitydive.com/news/sempra-capital-plan-texas-oncor-earnings/740953/)
- [Sempra: Oncor 127 GW pipeline / Seeking Alpha](https://seekingalpha.com/article/4903708-sempra-oncors-127-gw-pipeline-could-redefine-its-earnings-power)
- [Sempra: 2025 financial results / Sempra IR](https://www.sempra.com/newsroom/press-releases/sempra-reports-2025-financial-and-business-results)
- [NextEra to buy Dominion / CNBC](https://www.cnbc.com/2026/05/18/nextera-nee-dominion-energy-d-data-center-ai.html)
- [Dominion 2026: 48 GW contracted, $65B committed / TIKR](https://www.tikr.com/blog/dominion-energy-stock-in-2026-48-gigawatts-contracted-65-billion-committed-cvow-70-done)
- [NJ Nuclear renaissance / data center strains / Gridbrief](https://www.gridbrief.com/p/nj-nuclear-renaissance-data-center-strains-aep-weighs-pjm-spp-exit)
- [FERC orders PJM to craft colocation rules / Utility Dive](https://www.utilitydive.com/news/ferc-pjm-colocation-data-center/808368/)
- [PJM accelerates backstop auction / Utility Dive](https://www.utilitydive.com/news/pjm-accelerates-backstop-reliability-auction-amid-uncertainty-over-data-cen/820707/)
- [FERC data center colocation ruling guide / Introl](https://introl.com/blog/ferc-pjm-colocation-ruling-data-center-power-plant-guide-2025)

---

## Bitcoin miner → AI pivots

## Current state (May 2026) + stock %

Public Bitcoin miners are the wildcard tier of the AI buildout: brownfield grid-connected sites, cheap power contracts, and existing cooling — but mining economics have collapsed (CoinShares Q1'26: weighted-avg cash cost ~$90k/BTC vs ~$67k spot). The escape valve is leasing power + shells to AI/HPC tenants. Bernstein quantifies the re-rating: miners with active AI contracts trade at ~$6M/planned MW vs ~$3M/MW for pure-play miners. Q1 2026 was the first quarter Bitcoin hashrate declined YoY in 6 years as miners reallocated to GPUs.

**Re-rated (AI-pivot winners, YTD 2026 through late April):**
- **Core Scientific (CORZ)** — Emerged from Ch.11 early 2024, signed ~590 MW / 12-yr CoreWeave lease worth ~$10.2B; in July 2025 CoreWeave agreed to acquire CORZ all-stock at 0.1235 ratio (~$9B equity, ~$20.40/sh, 66% premium). Q1'26 stock hit $22.19, up ~10% on day. Now effectively becoming part of CoreWeave. Blueprint deal for the entire sector.
- **Applied Digital (APLD)** — North Dakota Polaris Forge campuses. Two 15-yr CoreWeave leases totaling 400 MW at Polaris Forge 1 / Ellendale (~$11B revenue, NVDA-backed CoreWeave). Polaris Forge 2 (Harwood ND): $5B 15-yr lease with US investment-grade hyperscaler for 200 MW (Oct 2025). Macquarie up-to-$5B perpetual preferred equity facility (first $112.5M drawn Oct 2025) plus dev loan Dec 2025. $2.35B senior secured notes. Total contracted backlog ~$16B (now ~$31B with Polaris Forge 3 lease). Stock ~$48–49, +88% YTD 2026, +540% TTM. Q2 FY26 revenue $126.6M (+250% YoY); 100 MW Ready-for-Service at Ellendale.
- **IREN (Iris Energy)** — ASX-origin, NASDAQ. 750 MW Childress TX campus + Mackenzie BC. Microsoft $9.7B GPU cloud contract. May 7, 2026: NVIDIA $3.4B 5-yr managed GPU cloud deal (60 MW Childress, air-cooled Blackwell) + NVDA warrants for up to 30M shares at $70 (~$2.1B). Dell $1.6B GPU hardware purchase. $625M all-stock Mirantis acquisition for software stack; acquiring Spain's Nostrum (5 GW global pipeline). 150,000 GPU target, ARR $3.7B by YE'26 → $4.4B post-NVDA. Stock +920% trailing 6 months; HC Wainwright downgraded to Sell on valuation.
- **TeraWulf (WULF)** — Lake Mariner NY (former coal site, hydro-powered, ~500 MW near-term, 750 MW potential). Fluidstack 10-yr 200+ MW deal worth $3.7B (up to $8.7B with extensions); Google backstops $1.8B + 8% equity warrants. Aug 2025 CB-5 expansion adds 160 MW; Google's total backstop now $3.2B, ~14% pro-forma equity. Q1'26: HPC revenue ($21M) exceeded mining ($13M) for first time. Stock +73.58% YTD 2026 (led the cohort through April); $900M equity raise April 2026.
- **Hut 8 (HUT)** — Formed via Nov 2023 USBTC merger. Spun out American Bitcoin as a separate listed BTC accumulation vehicle. River Bend project: $3.25B 16.5-yr investment-grade senior secured notes — first single-sponsor data center to access IG construction-bond market. 205 MW Vega ASIC center with proprietary 180 kW/rack liquid cooling. Beacon Point 15-yr / 352 MW lease with high-IG tenant worth $9.8B base term — triples contracted AI capacity to 597 MW. Stock +67.75% YTD, hit $117. Q1'26 ~$66M compute revenue (ASIC Compute via American Bitcoin, AI Cloud via Highrise AI subsidiary).
- **Cipher Mining / Cipher Digital (CIFR)** — Rebranded to Cipher Digital. 600 MW contracted across two hyperscale leases: 15-yr 300 MW AWS + 10-yr 300 MW Fluidstack/Google. Third 15-yr hyperscale lease added. ~$11.4B contracted revenue, $787M annualized contracted NOI. $3.73B raised across three bond offerings. Stock ran from ~$12 (Mar 30) to $22.10 (May 5, +23.5% day on Q1 results), +~32% YTD. Barber Lake + Black Pearl on schedule.
- **Galaxy Digital (GLXY)** — Helios TX site (acquired from Argo for $65M, 2022, in Dickens County). CoreWeave 15-yr lease for full 800 MW approved capacity, ~$1B/yr revenue (>$15B over term). ERCOT approved 830 MW expansion Jan 2026 → 1.6 GW total approved; potential 3.5 GW. $1.4B project financing facility + $460M equity raise at $36. First data hall handed over to CoreWeave Q1'26. Q1'26 GAAP loss $216M but Q2 EBITDA guide ~$90M. Stock up ~5% on print.
- **Bit Digital (BTBT)** — Spun HPC business into WhiteFiber (NASDAQ: WYFI, IPO Aug 2025), retained controlling stake. Acquired Enovum (Oct 2024) and inked Boosteroid MSA (cloud gaming, potential $700M). Parent BTBT now positioning as Ethereum treasury SAC (~155k ETH staked, ~89%). Q1'26 revenue $27.9M (-13.6% QoQ), adj EBITDA -$9.4M. Stock ~$2.02 (lagged, smaller scale).
- **HIVE Digital (HIVE)** — Canada/Sweden/Paraguay footprint. BUZZ HPC subsidiary, NVIDIA Cloud Partner. $30M AI cloud contract Feb 2026 (504 liquid-cooled Dell GPUs at Canada West, $15M ARR phase 1). Target 6,000–11,000 GPUs and $200–225M HPC ARR by FY end Mar 2027. Smaller and earlier in pivot. Buy rating, $2.82 PT.

## The pivot model

The model is essentially **"power-shell landlord for a neocloud tenant"**:

1. **Asset contribution from miner:** ERCOT/PJM/NYISO/MISO interconnection rights, energized substations, water rights, brownfield real estate, permits, operating staff. The scarce input is **time-to-power** — new interconnect studies take 4–7 years.
2. **Buildout:** Convert mining shed → tier-III liquid-cooled data hall with 100+ kW/rack density for GB200/GB300/Blackwell. Often tenant funds the fit-out (CoreWeave paid APLD $73M of tenant fit-out in one quarter alone).
3. **Tenant:** A NVDA-aligned "neocloud" (CoreWeave, Fluidstack, Nebius, Crusoe) or hyperscaler signs a 10–15 yr triple-net lease for the critical IT load. Counterparties are often credit-enhanced by big tech (Google backstops Fluidstack on WULF; NVDA preferred-supplier endorses CoreWeave).
4. **Financing:** Asset-level project finance, not corporate dilution. Macquarie's preferred-equity-at-the-asset model for APLD; Hut 8's investment-grade construction bonds for River Bend; CIFR's $3.73B bond stack — all designed to avoid printing common equity at the parent.
5. **Revenue recognition:** Lease revenue starts at "Ready-for-Service" (RFS) of each building, ramping over 18–36 months as buildings deliver. Backlog → ARR conversion is the share-price input the market is solving for.

This structure converts a commodity-margin BTC miner into something closer to a **single-tenant industrial REIT** with 15-year contracted cash flows — hence the re-rating from $3M/MW to $6M/MW (and CoreWeave itself trades far above that).

## Lagged comparables

- **Marathon Digital (MARA)** — Pivoting later via Starwood JV and Long Ridge acquisition (1 GW path with own gas plant), but still primarily perceived as a BTC proxy. Q1'26 net loss $1.3B (mostly BTC mark-to-market). Stock $11–14 range, still trades on Bitcoin moves. ~35k–50k BTC on balance sheet keeps it leveraged-BTC. Less AI contract traction than APLD/CORZ/IREN/WULF.
- **Riot Platforms (RIOT)** — Was "last pure-play miner standing" until Starboard activist pressure. AMD lease (50 MW, option to 150 MW; ~$636M/10-yr) at Texas site went live March 2026. Up ~147% TTM but starting from lower base; +60% from end-Jan. Only ~$33M of Q1 revenue from data center vs $112M mining. Sold 3,778 BTC to fund expansion while only producing 1,473. Catching up but still behind the leaders.
- **CleanSpark, Bitfarms, BitDeer** — Mostly remained miners, much smaller AI announcements; trade closer to BTC beta.

Key insight: **the gap between re-rated and lagged is execution speed on signing a credit-worthy hyperscaler/neocloud anchor.** Bernstein's $6M/MW vs $3M/MW gap maps directly onto "has signed a 10+ year lease" vs "hasn't yet."

## Risks (the pivot can fail)

1. **Capex intensity and dilution risk.** Even with project-finance structures, hyperscale AI fit-outs run $8–15M/MW. Miners that can't raise asset-level debt fall back on the equity tap.
2. **Counterparty concentration.** IREN ~55% of '26 revenue from Microsoft; CRWV itself is ~55% backlog from OpenAI/Meta. A single tenant going wobbly cascades.
3. **Neocloud is itself unproven at scale.** CoreWeave just raised $8.5B in AI-backed loans ("ComputeFi"). If hyperscaler GPU demand decelerates or NVDA pricing power compresses, neoclouds get squeezed and pass the pain to landlords.
4. **Execution / RFS slippage.** Each delayed building moves the company from contracted-capacity story to operating-revenue story. WULF's CB-3/4/5 cadence is the explicit Q2–Q4 2026 test.
5. **BTC rip pulls focus back.** A sharp BTC rally tempts management to redeploy power into ASIC mining at the margin (already happening at Riot historically).
6. **Power interconnect / utility risk.** ERCOT capacity allocation, grid stability rules, and large-load study queues remain the binding constraint. ND, TX, NY rules can shift mid-buildout.
7. **M&A absorption.** CoreWeave acquired CORZ; comparable rollups could compress the public miner universe (and remove the cheapest entry point to the trade).
8. **"AI infrastructure peak" macro risk.** If hyperscaler capex resets lower in 2027, 15-yr leases signed in 2026 hold up — but new signings stop, and the marginal price per MW falls back toward $3M.

## Cross-cutting connections

- **B10 → CoreWeave / Neoclouds:** CORZ, APLD, GLXY, WULF are essentially CoreWeave/Fluidstack landlord plays. CORZ acquired outright. Re-rating tied to neocloud equity multiples.
- **B10 → NVDA:** CoreWeave is NVDA preferred customer + NVDA equity holder ($2B at $87.20/sh Jan 2026, plus 5GW NVDA-CoreWeave buildout commitment). IREN's NVDA $3.4B managed cloud + 30M warrants is direct.
- **B10 → Power / grid:** Brownfield interconnect is the moat. Maps to the broader "interconnect queue" node — these miners had front-of-queue positions from the 2020–2022 mining buildout.
- **B10 → Project finance / Macquarie / IG bond market:** First time large single-sponsor data centers are accessing IG construction bonds (Hut 8 River Bend $3.25B). New asset class.
- **B10 → Google / Hyperscaler-backed credit:** Google's $3.2B backstop of Fluidstack-at-WULF is a new pattern: hyperscaler credit-enhances a neocloud at a miner site. Watch for replication.

## New nodes implied

- **"ComputeFi"** — the asset-backed-loan / project-bond financing model replacing crypto miner equity raises (CRWV $8.5B AI-backed loan with Meta backing; Hut 8 IG bonds).
- **Hyperscaler credit-enhancement of neoclouds** — Google backstopping Fluidstack at WULF; could become standard pattern.
- **Single-tenant data center REIT structure** — APLD, CORZ-pre-merger function this way; possible reclassification.
- **American Bitcoin (Hut 8 spinoff)** — listed pure-BTC accumulation vehicle, mirrors Strategy/MARA model.
- **WhiteFiber (BTBT spinoff, NASDAQ: WYFI)** — independent AI cloud vehicle distinct from parent miner.

## Sources
- [APLD Q2 FY2026 earnings release (SEC 8-K)](https://www.sec.gov/Archives/edgar/data/0001144879/000114487926000002/apldq226earningsrelease.htm)
- [APLD $5B AI Factory Lease at Polaris Forge 2 (press release)](https://ir.applieddigital.com/news-events/press-releases/detail/132/applied-digital-announces-5-billion-ai-factory-lease-with)
- [APLD stock analysis: Why APLD led market 2025 (Kavout)](https://www.kavout.com/market-lens/applied-digital-stock-analysis-why-apld-led-the-market-in-2025-and-what-to-expect-in-2026)
- [Inside APLD's AI pivot: 2026-2027 Lease Ramp (Nasdaq)](https://www.nasdaq.com/articles/inside-aplds-ai-pivot-how-2026-2027-lease-ramp-aid-stock)
- [CoreWeave to Acquire Core Scientific (press release)](https://investors.corescientific.com/news-events/press-releases/detail/119/coreweave-to-acquire-core-scientific)
- [Core Scientific Q1 FY2026 slides: $10B AI contracts, 3GW pipeline (Investing.com)](https://www.investing.com/news/company-news/core-scientific-q1-fy2026-slides-10b-ai-contracts-3-gw-pipeline-93CH-4665996)
- [CORZ stock surges on $1.2B CoreWeave expansion (CoinDesk)](https://www.coindesk.com/business/2025/02/26/core-scientific-stock-surges-after-usd1-2b-expansion-of-data-center-with-coreweave)
- [IREN $3.4B NVDA cloud contract (SEC 8-K)](https://www.sec.gov/Archives/edgar/data/0001878848/000114036126007905/ny20064909x3_ex99-1.htm)
- [IREN $9.7B Microsoft GPU cloud contract (Investing.com)](https://www.investing.com/news/company-news/iren-signs-97-billion-gpu-cloud-services-contract-with-microsoft-93CH-4326523)
- [IREN Q3 FY26 results (SEC 8-K)](https://www.sec.gov/Archives/edgar/data/0001878848/000187884826000025/irenreportsq3fy26results.htm)
- [TeraWulf 200+ MW Fluidstack agreements (press release)](https://investors.terawulf.com/news-events/press-releases/detail/112/terawulf-signs-200-mw-10-year-ai-hosting-agreements-with)
- [TeraWulf Fluidstack expansion CB-5 160 MW (SEC)](https://www.sec.gov/Archives/edgar/data/1083301/000110465925079463/tm2523651d3_ex99-1.htm)
- [WULF Q1 2026 results: AI revenue surge despite $427M loss (MEXC)](https://www.mexc.com/news/1080835)
- [TeraWulf nuclear-powered miner becoming AI infra (Longyield)](https://longyield.substack.com/p/terawulf-the-nuclear-powered-miner)
- [Hut 8 Q1 2026 10-Q (SEC)](https://www.sec.gov/Archives/edgar/data/0001964789/000110465926055891/hut-20260331x10q.htm)
- [Hut 8 Beacon Point / River Bend press release (SEC)](https://www.sec.gov/Archives/edgar/data/0001964789/000110465926049810/tm2612880d1_ex99-1.htm)
- [Bit Digital Q1 FY2026 10-Q (SEC)](https://www.sec.gov/Archives/edgar/data/0001710350/000121390026057116/ea0288833-10q_bitdigital.htm)
- [BTBT ETH-AI pivot deepens (Timothy Sykes)](https://www.timothysykes.com/news/bit-digital-inc-btbt-news-2026_05_22/)
- [Cipher Digital surges on AI data center shift (Motley Fool)](https://www.fool.com/coverage/stock-market-today/2026/05/05/stock-market-today-may-5-cipher-mining-surges-on-ai-data-center-shift-backed-by-hyperscale-leases/)
- [CIFR doubles down on AI data centers (StocksToTrade)](https://www.timothysykes.com/news/cipher-digital-inc-cifr-news-2026_04_17/)
- [Galaxy Helios ERCOT approval 1.6 GW (SEC)](https://www.sec.gov/Archives/edgar/data/0001859392/000185939226000005/heliosercotapproval_1x15.htm)
- [Galaxy $1.4B project financing for Helios (StockTitan)](https://www.stocktitan.net/news/GLXY/galaxy-closes-1-4-billion-project-financing-facility-to-accelerate-m1g6nrtnwvpm.html)
- [Galaxy Q1 2026 results / Helios first data hall to CoreWeave (CoinCentral)](https://coincentral.com/galaxy-digital-glxy-stock-drops-as-q1-loss-hits-216m-but-coreweave-deal-changes-the-story/)
- [MARA Q1 2026 earnings call (Investing.com)](https://www.investing.com/news/transcripts/earnings-call-transcript-marathon-digitals-q1-2026-sees-strategic-shifts-amid-financial-losses-93CH-4694948)
- [MARA AI power pivot (TS2)](https://ts2.tech/en/mara-stock-jumps-near-14-as-bitcoin-miners-ai-power-pivot-grabs-wall-streets-attention/)
- [Riot AMD data center 150 MW expansion (CoinDesk)](https://www.coindesk.com/markets/2026/05/01/bitcoin-miner-riot-s-shares-jump-8-after-expanding-amd-data-center-deal-signaling-ai-pivot)
- [Why RIOT is surging in 2026: from BTC mines to AI (Anna Coulling)](https://www.annacoulling.com/stock-trader-tips/from-bitcoin-mines-to-ai-powerhouses-why-riot-platforms-riot-is-one-of-the-most-intriguing-plays-in-the-energy-hungry-ai-era/)
- [HIVE BUZZ $30M AI cloud contracts (StockTitan)](https://www.stocktitan.net/news/HIVE/hive-s-buzz-signs-30-million-in-ai-cloud-contracts-accelerating-edicpi80jq11.html)
- [HIVE pivoting deeper into HPC + robotics (Seeking Alpha)](https://seekingalpha.com/article/4883509-hive-digital-pivoting-deeper-into-hpc-and-robotics-for-long-term-growth)
- [Neocloud stocks: CRWV, NBIS, IREN, APLD in 2026 (TECHi)](https://www.techi.com/neocloud-stocks/)
- [Bitcoin miners pivot to AI: stocks to watch (Trade Ideas)](https://www.trade-ideas.com/2026/05/01/bitcoin-miners-pivot-ai-stocks/)
- [Bitcoin's first Q1 hashrate drop in 6 years: AI pivot rewriting mining (BlockEden)](https://blockeden.xyz/blog/2026/05/04/bitcoin-hashrate-q1-decline-miners-pivot-ai-hpc-infrastructure/)
- [Miners beat Bitcoin by 70% in 2026 as TeraWulf locks $12.8B AI contracts](https://bitcoinethereumnews.com/bitcoin/miners-beat-bitcoin-by-70-in-2026-as-terawulf-locks-12-8b-in-ai-contracts/)
- [CoreWeave $8.5B AI loan: MinerFi to ComputeFi shift (Cointelegraph)](https://cointelegraph.com/news/coreweave-8-5b-ai-loan-shift-crypto-mining-to-computefi)
- [Bitcoin miner-to-AI boom: Cipher and Hut 8 fresh highs (The Block)](https://www.theblock.co/post/402773/bitcoin-miner-ai-boom-stocks-soaring-cipher-hut-8-fresh-highs)
- [Why bitcoin miners' AI pivot could be the boon they need (DL News)](https://www.dlnews.com/articles/markets/bitcoin-miners-ai-pivot-holds-auspicious-future/)

---

## Dell AI server BOM decomposition

## The user's question

Dell just printed Q1 FY27 on May 28, 2026: **revenue $43.8B (+88% YoY)**, AI-optimized server revenue **$16.1B (+757% YoY)**, AI orders **$24.4B**, **AI backlog $51.3B** (up from $43B exiting FY26), and management raised FY27 AI server guide from ~$50B to **$60B** and total revenue to **$167B**. Stock closed **$317.05 May 28 (+25% in a week, +183% over 1Y, ~+221% YTD into earnings)**, then ripped another ~29% after-hours.

GAAP gross margin fell to **17.8% from 21.1%** YoY; non-GAAP 18.1% from 21.6%. Mgmt reiterated **mid-single-digit operating margin target for AI servers**. So Dell is winning by carrying a lot of NVDA/HBM/cable revenue at very thin margin — the real "AI buildout" winners are upstream. This node tears apart what's actually inside a PowerEdge XE9712 (GB300 NVL72) rack and an XE9680 8-GPU box, who supplies each line, and how much of the AI rally each supplier has captured.

## What's actually in a Dell AI server

### Dell PowerEdge XE9712 — NVIDIA GB300 NVL72 rack (the centerpiece)

- **48U IR9048 rack**, 21" OCP-style. Dell shipped the **first GB300 NVL72 in the industry** in early summer 2025 to **CoreWeave** (~7 months after first GB200 NVL72).
- **72x NVIDIA Blackwell Ultra (B300) GPUs** + **36x NVIDIA Grace ARM CPUs** (18x GB300 "Superchip" trays, 2 GPUs + 1 CPU per Superchip × 36). 1 exaflop of dense AI per rack; **~21 TB of fast memory per rack** (HBM3e + Grace LPDDR), up from 13.5 TB on GB200 NVL72.
- **NVLink5 switch trays** for all-to-all GPU fabric inside the rack.
- **NVIDIA Quantum-X800 InfiniBand or Spectrum-X Ethernet** scale-out + **ConnectX-8 SuperNICs / BlueField-3 DPUs**.
- **Direct-to-chip liquid cooling**, ~1.75 MW DLC + 0.25 MW air per rack envelope; **Vertiv CDU** anchors the loop. Dell's "PowerCool" branded.
- **All-NVMe storage** (E1.S / E3.S).
- **Indicative all-in retail per rack: ~$3.7M for GB200 NVL72, $3.8–4.2M for GB300 NVL72** (more HBM, more thermal kit).

### Dell PowerEdge XE9680 — 6U, 8-GPU HGX node (the H100/H200/B200 workhorse)

- **8x NVIDIA HGX H100 80GB / H200 141GB / B200 / B300 SXM5** OR **8x AMD MI300X 192GB** OR **8x Intel Gaudi 3 128GB** — same chassis, three accelerator families.
- **2x Intel Xeon 5th-gen Emerald Rapids (up to 64c) or 4th-gen Sapphire Rapids (56c)**.
- **32x DDR5 RDIMM slots, up to 4 TB**, 5600 MT/s.
- **PERC H965i RAID; BOSS-N1 M.2 boot RAID; up to 8x U.2 NVMe or 16x E3.S NVMe** (up to 122.88 TB front).
- **Up to 10 front PCIe Gen5 slots**.
- **6+ PSUs, 2800W each, 3+3 redundancy with GPU Power Brake.**
- Mandatory ProDeploy Plus (Dell-staffed GPU subsystem tests).

## Bill of materials — who gets paid for each line

| Component | Supplier(s) | $/rack (GB300 NVL72) | Graph node | 2026 stock context |
|---|---|---|---|---|
| **GPUs (72x B300)** | **NVIDIA** | ~$2.4–2.6M | **C1** | NVDA Q1 FY27 rev $81.6B (+85%), DC $75.2B (+92%); ~$5.2T mkt cap; supply commits doubled to $145B |
| **CPUs (36x Grace ARM)** | NVIDIA (ARM v9 Neoverse) | ~$150–200K | **C1 / C3** | ARM up ~84% YTD, FY26 rev $4.92B +23%; Vera CPU $20B FY27 target |
| **HBM3e** (14–17 TB/rack) | **SK Hynix** (~55%), **Samsung** (~22%), **Micron** (~21%) | ~$450–550K | **M1/M2/M3** | HBM3e +20% price hike for 2026; capacity sold out through 2026/2027; trio crossed $3T combined mkt cap |
| **Server DRAM (non-HBM)**, 30–40 TB | Micron, SK Hynix, Samsung | ~$120–180K | **M1/M2/M3** | Server DRAM Q1 prices +60–70% Q/Q; multi-year contracts being rejected |
| **NAND / NVMe SSDs** | **Sandisk**, **Kioxia**, **Solidigm (SK Hynix)**, Micron, Samsung | ~$60–120K | **M4/M5/M6** | Top-5 NAND Q1 rev +83.7% Q/Q to $38.9B; Sandisk DC biz +200%+ Q/Q |
| **NVLink switch / NVSwitch trays** | NVIDIA | ~$120K | **C1** | Bundled in NVDA networking line (now $14.8B/qtr, +199% YoY) |
| **Scale-out switch silicon** (Quantum-X800 IB or Spectrum-X) | NVIDIA + **Broadcom Tomahawk 6** in some Ethernet configs | ~$100K | **W1 / C4** | AVGO AI rev $8.4B (+106%); Tomahawk 6 102.4 Tbps; $73B AI backlog |
| **Optical transceivers** (800G OSFP, ramp to 1.6T) | **Coherent**, **Lumentum**, Innolight, AAOI, Eoptolink | ~$150–250K (rack scales to 100+ modules) | **W2** | COHR +97% YTD, LITE +166% YTD, AAOI +441% YTD; AI optics TAM $26B in 2026 |
| **AECs / DACs (copper inside rack)** | **Amphenol** (Paladin HD2, OverPass), **TE Connectivity**, **Credo** (linear modules) | ~$80–120K (NVL72 uses ~5,000 NVLink copper cables) | **B6 / B2** | APH Q1 rev $7.6B +58%, $9.4B orders, 1.24 book-to-bill; CommScope CCS acquired |
| **DPUs / SmartNICs** (BlueField-3, ConnectX-8) | NVIDIA | ~$60–80K | **B5** | Bundled in NVDA DC networking |
| **PCIe retimers / fabric switches** | **Astera Labs** (Aries, Scorpio), **Marvell** Structera, **Credo** Toucan | ~$30–60K | **W4** | ALAB Q1 rev $308M +93%, GAAP GM 76%; Scorpio X 320-lane shipping; ~$60B mkt cap |
| **BMC** (1 per node) | **ASPEED** AST2600/AST2700 | ~$10–20K | **B4** | 5274.TW: GS target NT$22,000 (3x YTD raise); 2026 unit guide 29.5M (+56%) |
| **ABF substrate** (per GPU/CPU/switch) | **Ibiden**, **Unimicron**, **Shinko**, AT&S, Nan Ya PCB | ~$30–50K | **B4** | Unimicron upgraded by MS (PT NT$500, 105% CAGR '25–'28); Ibiden margin pressured by capex |
| **HDI / backplane PCBs** (20–30 layer) | **TTM**, Unimicron, Nan Ya, Zhen Ding | ~$40–60K | **B4** | TTM/Foxconn/Jabil basket re-rated on AI mix |
| **Power supplies** (54V/800V) | **Delta Electronics**, **Lite-On**, FSP | ~$100–140K | **B3** | Delta + Lite-On + FSP ~35% share; Delta 2308.TW +540%+ over 1Y range (NT$365 → NT$2,410) |
| **Power management ICs / vertical power** | **Monolithic Power Systems**, Texas Instruments, **Vicor**, Infineon | ~$30–50K | **B3** | MPWR ~$1,576, +149% 1Y, joined NDX Dec '25; EnterpriseData growth floor lifted to 50%+ on 800V |
| **Connectors** (high-speed, near-chip) | **Amphenol** (Paladin/OverPass), **TE Connectivity**, Molex | ~$30–50K | **B2** | APH at all-time highs $147; TEL lagging APH on 224G race |
| **Liquid cooling — CDU, manifolds, cold plates** | **Vertiv** (CDU), **CoolIT**, **Boyd** (via Eaton), **Modine** (chillers), Asetek | ~$120–180K | **D2** | VRT +115% YTD, ~$15B backlog (+109%); raised FY26 rev $13.5–14.0B; acquired STL + ThermoKey + PurgeRite |
| **Rack chassis + tray + manifold ODM assembly** | **Foxconn** (Hon Hai), **Quanta** (QCT), **Wistron / Wiwynn**, Inventec | ~$80–150K | **B1** | Wiwynn Q1 rev NT$276.5B +62%; Quanta NT$809B +66.6%; Foxconn guiding Q2 +Y/Y; AWS ASIC mass-prod Q2 boost |
| **Cabinet, busbar, rack hardware** | NVDA reference design + Foxconn/Quanta build | ~$30–50K | **B1** | Mexico nearshoring (Foxconn Guadalajara, Quanta Monterrey) live for GB200/300 |
| **Front-of-rack networking switches** | **Arista**, Cisco, NVIDIA | ~$60–100K | **W3** | Arista tracking AVGO; Cisco AI infra orders >$3B FY26 |
| **Software / Dell stack / integration / Smart Cooling firmware** | Dell + NVIDIA AI Enterprise license | (mostly margin) | DELL | Dell takes a slim cut |

**Sub-totals (mid-point, GB300 NVL72):** NVDA silicon ~$2.7M • HBM ~$500K • DRAM/NAND ~$220K • Networking + transceivers ~$370K • Power + cooling ~$370K • Connectors + cables ~$130K • ODM chassis + rack ~$200K • BMC + substrate + PCB + PMIC ~$130K. **Total component COGS ~$4.5M** against a ~$3.8–4.2M retail — i.e., Dell's *gross dollars* live in service contracts, ProDeploy, financing, support multipliers, and the few low-cost lines (assembly, software). That is why **Dell's AI gross margin is single-digit and operating margin is mid-single-digit.**

## What makes it AI-optimized (vs a regular PowerEdge R760)

1. **Direct-to-chip liquid cooling** for >40 kW/U thermal load. GB300 NVL72 hits ~120 kW/rack steady-state. Air cooling caps at ~30 kW/rack — liquid is mandatory above that.
2. **800V DC busbar architecture** (replacing 12V/48V intermediate stages); MPWR / Delta / Vicor sample 800V vertical power delivery. Eliminates rack-level PDUs and dramatically cuts I²R loss.
3. **NVLink5 + NVSwitch trays** inside rack — 1.8 TB/s per GPU bidirectional, vs ~600 GB/s PCIe Gen5.
4. **HBM3e (192–288 GB/GPU)** instead of commodity DDR — 5–6x cost premium per GB, 10–20x bandwidth.
5. **800G OSFP optics (ramping to 1.6T)** with NVDA Quantum-X800 InfiniBand or Spectrum-X Ethernet back end — every GPU lights up multiple optical lanes.
6. **High-density E3.S NVMe** with PCIe Gen5 — replaces SAS for GPU-fed checkpoint and dataset throughput.
7. **N+N power supplies (6+ PSUs/node, 2800W each)** with GPU Power Brake firmware — manages transient power swings during training.
8. **AST2600/2700 BMC with GPU telemetry firmware** — per-GPU temp/power/HBM ECC, OCP Caliptra root-of-trust, Redfish telemetry.
9. **ABF substrate + CoWoS-bonded HBM** — every GPU has Ajinomoto ABF film + Ibiden/Unimicron/Shinko substrate + TSMC CoWoS-L packaging.
10. **Rack-scale design**: shipped as a single 48U integrated rack, not loose servers — Dell becomes a *systems integrator*, not a server vendor.

## Margin reality — Dell is a thin integrator

- **ISG Q1 FY27: rev $29.0B (+181%); ISG op margin 10.5%.** AI servers specifically guided to **mid-single-digit operating margin** by mgmt.
- **GAAP gross margin 17.8% (down ~330 bps Y/Y)** — driven by AI mix; the cost stack above is why.
- Dell's value-add is: (a) **supply-chain orchestration** (locking up NVDA, HBM, Vertiv, ODM capacity early), (b) **enterprise sales + service footprint** (CoreWeave, xAI, Elon's Colossus II), (c) **integration + ProDeploy** (mandatory for XE), (d) **financing** (DFS). 
- **Dell vs comparables:**
  - **SMCI**: similar role, faster product cadence (4-week lead on Blackwell sleds), 70–80% share of DLC racks, but **stock down ~7% YTD 2026 / –24% 1Y** — penalized for past accounting issues, share loss to Dell on hyperscalers.
  - **HPE**: **+89% 1Y, +20% YTD 2026**; ProLiant XR8000 / Cray; Juniper acquisition gave them networking. Laggard on AI server share but recovering.
  - **Hyperscalers (MSFT, META, AWS, GOOG) bypass Dell entirely** for their own ASIC builds — Wiwynn, Quanta, Foxconn ship direct. This is the structural threat to Dell over time (offset by sovereign AI + neoclouds like CoreWeave + enterprise GenAI demand).

## Stock-mover ranking — who actually captured the rally

**Top movers (verified YTD 2026 or recent trailing windows):**

1. **Sandisk (SNDK)** — **+~505% YTD**, all-time high $1,641.64 May 28; NAND supercycle + DC mix
2. **Applied Optoelectronics (AAOI)** — **+~441% YTD** on 800G transceiver ramp
3. **Dell (DELL)** — **+221% YTD into earnings**, then +~29% AH on May 28 print
4. **Lumentum (LITE)** — **+~166% YTD**
5. **Marvell (MRVL)** — **+~130% YTD** on custom ASIC + electro-optics
6. **Vertiv (VRT)** — **+~115% YTD**, $15B backlog, ~$339 mid-May
7. **Coherent (COHR)** — **+~97% YTD**, $2B NVDA investment
8. **ARM Holdings (ARM)** — **+~84% YTD**
9. **HPE** — +~20% YTD / +~89% 1Y
10. **MPWR** — +~149% 1Y, near all-time highs
11. **Amphenol (APH)** — Q1 rev $7.6B +58%; record highs >$147; ~$180B mkt cap
12. **ASPEED (5274.TW)** — GS target NT$22,000 (~3x YTD raise); near NT$19,000
13. **Unimicron (3037.TW)** — ~+55% YTD; MS PT NT$500 (105% CAGR projected)
14. **Wiwynn (6669.TW)** — +~65% 1Y but ~–20% from peak (Q4 reset)
15. **Delta Electronics (2308.TW)** — 52w range NT$365 → NT$2,410 (~6x), now ~NT$2,350
16. **Astera Labs (ALAB)** — Q1 +93% rev; ~$319/share; trades above consensus PT

**Middle of the pack:**
- **Broadcom (AVGO)** — AI rev $8.4B +106%; $73B backlog; trading at >15x P/S but moderate YTD vs peers
- **NVIDIA (NVDA)** — "only" ~$5.2T mkt cap; stock fell 1.5% post-earnings May 20 — pricing in perfection
- **Micron (MU)** — UBS PT tripled to $1,625; market cap crossed $1T
- **SK Hynix** — +9% in single day, mkt cap ~₩1,680T (~$1.12T)
- **AMD** — +~118% 1Y but mid-pack YTD; OpenAI/Meta 6GW each
- **Quanta (2382.TW)** — +~10% 1Y vs TAIEX +40%; underperformed despite Q1 rev +66.6%
- **Foxconn (2317.TW)** — +~23% 1Y; lagged Wiwynn

**Laggards / underperformers:**
- **Super Micro (SMCI)** — –7% YTD / –24% 1Y
- **TE Connectivity (TEL)** — losing share to APH on 224G race
- **Ibiden (4062.JP)** — down ~17% from 52w high; capex/depreciation drag despite 70–80% share in high-end substrates
- **Samsung Memory** — gaining late HBM4 (MI455X) but lags SK Hynix
- **Intel (INTC)** — now in recovery: +~100% 1Y under Lip-Bu Tan; 18A yields 65–75%; Terafab + Apple wins
- **NetApp** — storage market share losses in AI use cases vs Solidigm/Sandisk QLC

**Read of the BOM ranking:** The cleanest "pick-and-shovel" returns concentrated in **memory (Sandisk/SK Hynix/Micron), optical (COHR/LITE/AAOI), liquid cooling (VRT), and power (MPWR/Delta/ASPEED)** — exactly the lines where AI servers carry 5–20x more content than a 2022-era CPU server, AND where supply is structurally tight (HBM/CoWoS/ABF/transceiver lasers). The OEMs (Dell, SMCI, HPE) sit *between* a hot supply chain and a price-disciplined hyperscaler/neocloud customer — they capture revenue but compressed margin.

## Cross-cutting

- **C1** NVDA (~60%+ of rack BOM)
- **C2** AMD (alt accelerator in XE9680)
- **C3** ARM (Grace/Vera CPU royalties)
- **C4** Custom ASICs (Broadcom Tomahawk in some Dell Ethernet SKUs; OpenAI/Meta bypass risk)
- **C5** Intel (Xeon for non-rack XE9680; foundry for some BMC/substrate)
- **M1/M2/M3** HBM trio (SK Hynix/Samsung/Micron)
- **M4/M5/M6** NAND trio (Sandisk/Kioxia/Solidigm) + Micron
- **W1** Networking ASICs (Broadcom, Marvell switching)
- **W2** Optical transceivers (Coherent, Lumentum, Innolight, AAOI)
- **W3** Front-of-rack switches (Arista, Cisco)
- **W4** Retimers / PCIe (Astera Labs, Credo, Marvell Structera)
- **B1** ODM assembly (Foxconn, Quanta, Wiwynn, Inventec)
- **B2** Connectors (Amphenol, TE Connectivity)
- **B3** Power (Delta, Lite-On, MPWR, Vicor, TI)
- **B4** Substrate / PCB / BMC (Ibiden, Unimicron, Shinko, TTM, Nan Ya, ASPEED)
- **B5** DPUs / SmartNICs (NVDA BlueField)
- **B6** AECs / DACs (Amphenol, Credo)
- **D2** Liquid cooling (Vertiv, CoolIT, Boyd/Eaton, Modine)
- **C1 ↔ D2** Power/cooling tail upstream into utilities + gas turbine + nuclear PPA nodes

## Sources

- [Dell Q1 FY27 8-K Press Release (SEC)](https://www.sec.gov/Archives/edgar/data/0001571996/000157199626000021/exhibit991earnings8kq1fy27.htm)
- [Dell Q4 FY26 8-K (SEC)](https://www.sec.gov/Archives/edgar/data/0001571996/000157199626000003/exhibit991earnings8kq4fy26.htm)
- [Dell Q1 FY27 Motley Fool transcript](https://www.fool.com/earnings/call-transcripts/2026/05/28/dell-dell-q1-2027-earnings-call-transcript/)
- [Bloomberg: Dell boosts AI server outlook to $60B FY27](https://www.bloomberg.com/news/articles/2026-05-28/dell-boosts-outlook-to-60-billion-in-ai-server-sales-this-year)
- [Blocks&Files: Dell's extraordinary AI server acceleration](https://www.blocksandfiles.com/ai-ml/2026/05/29/dells-extraordinary-ai-server-revenue-acceleration/5248541)
- [Dell delivers first GB300 NVL72 to CoreWeave](https://www.dell.com/en-us/blog/dell-delivers-market-s-first-nvidia-gb300-nvl72-to-coreweave/)
- [Dell PowerEdge XE9712 Spec Sheet (PDF)](https://www.delltechnologies.com/asset/en-us/products/servers/technical-support/poweredge-xe9712-spec-sheet.pdf)
- [Tom's Hardware: Dell first GB200 NVL72 shipments](https://www.tomshardware.com/tech-industry/artificial-intelligence/dell-reaches-milestone-with-industrys-first-enterprise-ready-nvidia-blackwell-poweredge-xe9712-server-racks)
- [Dell PowerEdge XE9680 Technical Guide (PDF)](https://www.delltechnologies.com/asset/en-ca/products/servers/technical-support/poweredge-xe9680-technical-guide.pdf)
- [Dell PowerEdge XE9680 Spec Sheet (PDF)](https://www.delltechnologies.com/asset/en-us/products/servers/technical-support/poweredge-xe9680-spec-sheet.pdf)
- [NVIDIA Q1 FY27 Press Release (SEC)](https://www.sec.gov/Archives/edgar/data/0001045810/000104581026000051/q1fy27pr.htm)
- [TrendForce: HBM3E +20% price hike for 2026](https://www.trendforce.com/news/2025/12/24/news-samsung-sk-hynix-reportedly-plan-20-hbm3e-price-hike-for-2026-as-nvidia-h200-asic-demand-rises/)
- [TrendForce: server DRAM +60–70% Q/Q for Q1](https://www.trendforce.com/news/2026/01/06/news-samsung-sk-reportedly-hike-server-dram-prices-60-70-google-microsoft-in-the-queue/)
- [Silicon Analysts: HBM market share & pricing 2026](https://siliconanalysts.com/tools/hbm-analysis)
- [SemiMedia: NAND Q1 +83.7% Q/Q, Sandisk DC +200%](https://www.semimedia.cc/21071.html)
- [Blocks&Files: Kioxia rides AI wave to record revenues](https://www.blocksandfiles.com/flash/2026/05/21/kioxia-rides-the-ai-wave-to-record-revenues-and-a-us-listing/5241267)
- [Vertiv Q1 2026 8-K (SEC)](https://www.sec.gov/Archives/edgar/data/1674101/000119312526120863/d94872dex991.htm)
- [Alphastreet: VRT +64%/+115% YTD rally, $15B backlog](https://news.alphastreet.com/vertiv-holdings-nysevrt-extends-2026-rally-after-64-surge-ai-data-center-demand-and-cooling-backlog-in-focus/)
- [24/7 Wall St: AAOI +441% / LITE +166% / COHR +97% YTD](https://247wallst.com/investing/2026/05/12/which-optics-stock-has-dominated-in-2026-applied-optoelectronics-lumentum-or-coherent/)
- [Invezz: Coherent + Lumentum AI optical surge](https://invezz.com/news/2026/05/13/coherent-lumentum-stocks-continues-surge-how-high-can-the-ai-trade-go/)
- [TrendForce: AI optical transceiver market $26B 2026](https://www.trendforce.com/presscenter/news/20260420-13017.html)
- [Astera Labs Q1 2026 8-K (SEC)](https://www.sec.gov/Archives/edgar/data/0001736297/000173629726000017/q126exhibit991.htm)
- [TIKR: ALAB +227% over 1Y](https://www.tikr.com/blog/astera-labs-stock-is-up-227-in-one-year-heres-whats-driving-the-rally)
- [Amphenol Q1 2026 record results, +58% rev, APH all-time highs](https://markets.financialcontent.com/stocks/article/marketminute-2026-1-12-the-silent-engine-of-the-ai-revolution-amphenol-hits-record-highs-as-data-center-infrastructure-demands-explode)
- [BigGo: Goldman raises ASPEED PT to NT$22,000](https://finance.biggo.com/news/IOfV_Z0BrAZSr0oSPwcf)
- [ASPEED AST2700 BMC product page](https://www.aspeedtech.com/server_ast2700/)
- [Digitimes: Foxconn/Wistron/Quanta NT$1T AI server in 2026](https://www.digitimes.com/news/a20260109PD249/revenue-ai-server-foxconn-wistron-quanta.html)
- [Digitimes: Q1 Taiwan ODM record on AI server demand](https://www.digitimes.com/news/a20260210PD205/taiwan-ai-server-odm-demand-supply-chain-2026.html)
- [Digitimes: Delta + Lite-On AI server power demand](https://www.digitimes.com/news/a20260512VL215/demand-taiwan-electronics-ai-server-revenue.html)
- [Investing.com: MS upgrades Unimicron + Nan Ya PCB on AI ABF](https://www.investing.com/news/stock-market-news/morgan-stanley-upgrades-unimicron-nypcb-on-ailed-abf-substrate-upcycle-4519224)
- [Digitimes: ABF substrate crunch, Unimicron leads](https://www.digitimes.com/news/a20260130PD220/unimicron-abf-substrate-ai-server-market-capacity.html)
- [Simply Wall St: MPWR AI power architect at all-time highs](https://simplywall.st/community/narratives/us/semiconductors/nasdaq-mpwr/monolithic-power-systems/cafbznfq-monolithic-power-systems-mpwr-the-ai-power-architect-at-all-time-highs)
- [FinancialContent: Broadcom AI rev +106% Q1 FY26](https://markets.financialcontent.com/stocks/article/marketminute-2026-3-24-broadcoms-ai-revenue-rockets-106-to-84-billion-as-custom-silicon-dominates-the-infrastructure-build-out)
- [Yahoo: Morgan Stanley picks Broadcom over Marvell as top AI chip play 2026](https://finance.yahoo.com/news/morgan-stanley-picks-broadcom-over-124709742.html)
- [Sandisk SNDK 1-year price history (Macrotrends)](https://www.macrotrends.net/stocks/charts/SNDK/sandisk/stock-price-history)
- [24/7 Wall St: Dell/SMCI/HPE 1Y comparison](https://247wallst.com/investing/2026/05/01/dell-super-micro-or-hpe-which-ai-server-stock-crushed-it-in-april/)
- [Heygotrade: Super Micro SMCI analysis 2026](https://www.heygotrade.com/en/blog/smci-stock-analysis/)
- [Motley Fool: Dell +221% YTD, blew out earnings May 28](https://www.fool.com/investing/2026/05/29/dell-just-blew-out-earnings-as-it-joins-the-ai-party-should-investors-buy-the-stock-after-its-221-run-this-year/)

_new_nodes_suggested:
- **B11.1 Dell margin compression deep-dive** — Dell ISG op margin 10.5% but AI-server-specific operating margin only mid-single-digit. Map the cost stack: NVDA take-rate, HBM allocation pricing, Vertiv CDU pass-through, ODM labor share. Determine whether margin recovers as scale grows or compresses further as hyperscalers concentrate purchasing power.
- **B11.2 Neocloud customer concentration (CoreWeave, Nebius, Lambda, Crusoe)** — Dell's first GB200 and GB300 shipments went to CoreWeave; xAI Colossus II ordered from Dell. Map the neocloud customer concentration risk and how it ties Dell to a small set of debt-financed buyers.
- **B11.3 Hyperscaler bypass risk** — MSFT, META, AWS, GOOG buy directly from Foxconn/Quanta/Wiwynn for ASIC builds (Maia, MTIA, Trainium, TPU). Quantify what % of total AI server spend Dell is structurally locked out of, and whether sovereign AI / enterprise GenAI can offset.
- **B11.4 Dell Smart Power / PowerCool firmware as soft moat** — Dell-specific BMC firmware for GPU power-brake, liquid-cooling telemetry, and Smart Cooling could be the durable IP differentiator. Worth its own node if it explains the integration premium.
- **B11.5 800V DC architecture transition** — The shift from 12V/48V to 800V DC busbar architecture is a once-per-decade rearchitecting. Winners (MPWR vertical power, Delta DC-DC, Vicor) and losers (legacy 12V regulator vendors) are clear but the timing/magnitude deserves its own node.
- **B11.6 ProDeploy + DFS as Dell's real moat** — Mandatory ProDeploy Plus + Dell Financial Services may be where Dell's real margin lives, not in the box. Worth investigating service+finance attach rates separately from hardware.

## Cross-cutting

- C1 (NVDA), C2 (AMD), C3 (ARM), C4 (Custom ASICs), C5 (Intel)
- M1 (SK Hynix), M2 (Samsung), M3 (Micron), M4 (Sandisk), M5 (Kioxia), M6 (Solidigm)
- W1 (Networking ASICs), W2 (Optical transceivers), W3 (Front-of-rack switches), W4 (Retimers/PCIe)
- B1 (ODM assembly), B2 (Connectors), B3 (Power), B4 (Substrate/PCB/BMC), B5 (DPUs), B6 (AECs/DACs)
- D2 (Liquid cooling)
- Upstream demand: hyperscaler capex node, neocloud financing node, sovereign AI node
- Upstream supply: TSMC CoWoS, HBM allocation, ABF substrate
- Downstream: power/grid, water, gas turbine, nuclear PPA

---

## Stock movers scoreboard 2025-2026

## Top 10 movers (1-yr / 2025-26 cumulative)

1. **SNDK (Sandisk)** — ~+4,155% trailing 12-mo; +~592% YTD 2026. NAND spinoff caught the AI memory squeeze, S&P 500 winner.
2. **SK Hynix (000660.KS)** — +~1,000% trailing 12-mo; +~259% YTD 2026. HBM monopoly, sold-out 2026, $1T+ market cap.
3. **WDC (Western Digital)** — +~919% trailing 12-mo; +~208% YTD 2026. HDD scarcity, HAMR pricing power.
4. **STX (Seagate)** — +~295% trailing 12-mo; +~190% YTD 2026. HAMR ramp, exabyte demand.
5. **DELL** — +~112% trailing 12-mo; +~234% YTD 2026. $16B AI server qtr, $60B FY27 guide.
6. **NBIS (Nebius)** — +~444-510% trailing 12-mo; ~doubled YTD. 684% qtr revenue, Meta/MSFT deals.
7. **MU (Micron)** — +~200%+ YTD. HBM3E/4E ramp, sold-out 2026.
8. **INTC** — +~405% trailing 12-mo; +~195-217% YTD 2026. Reversal/turnaround, Q1 EPS beat.
9. **LITE (Lumentum)** — +~166% YTD 2026. Optical for 800G/1.6T transceivers.
10. **VRT (Vertiv)** — +~115% YTD 2026; +~190% 1-yr. Liquid cooling, $15B backlog.

## Top 10 laggards (vs sector / negative or low)

1. **NTAP (NetApp)** — -~20% trailing 12-mo. Public-sector / EMEA cautious; only flash-storage laggard.
2. **SMCI (Super Micro)** — -~7% YTD, -~24% 1-yr. Governance overhang, share loss to DELL.
3. **PONY (Pony AI)** — -~40% YTD. Robotaxi growth ignored, 52-wk low despite +145% revenue.
4. **MBLY (Mobileye)** — -~2.5% YTD. Bouncing but still negative; AV laggard.
5. **TEL (TE Connectivity)** — -~9% YTD. AI lagging vs APH; auto cycle drag.
6. **APH (Amphenol)** — -~5% YTD May 2026 (after +98% YTD earlier 2026 spike, gave back).
7. **RGTI (Rigetti)** — -~10% to -24% YTD 2026 (after +6,217% 2025).
8. **QBTS (D-Wave)** — -~9% to -26% YTD 2026 (after +3,912% 2025).
9. **NEE (NextEra)** — +~16% YTD; -~4% on Dominion deal news. Lagging utility considering AI thesis.
10. **ROK (Rockwell)** — +~1.4% YTD. Despite raised guidance, no AI re-rate.

## Full scoreboard

### Compute chips
| Ticker | Co | 2025 % | YTD 2026 % | MktCap | One-liner | Paired comparable |
|---|---|---|---|---|---|---|
| NVDA | Nvidia | ~+170% | ~+15% | ~$5.2T | GPU monopoly, Blackwell/Rubin | AMD (laggard 2025, leader 2026) |
| AMD | AMD | ~-15% | ~+90%+ (TTM +267%) | ~$850B | MI300/MI400 inference share gainer | NVDA |
| ARM | ARM Holdings | ~+30% | ~+100% | ~$280B | v9/Neoverse for hyperscaler ASICs | INTC (parallel CPU re-rate) |
| INTC | Intel | ~-50% | ~+200% | ~$520B | Turnaround, EPS beat, foundry hope | AMD |
| AVGO | Broadcom | ~+115% | ~+22% | ~$2.1T | Custom XPU (Google TPU, Meta MTIA), VMware | MRVL |
| MRVL | Marvell | ~+5% | ~+15% (est) | ~$80B | Custom AI silicon (AWS Trainium adj) | AVGO |
| TSM | TSMC | ~+95% | ~+31% | ~$1.4T | Sole leading-edge foundry | ASML |
| ASML | ASML | ~+5% | ~+30% | ~$420B | EUV monopoly | LRCX/AMAT |
| AMAT | Applied Materials | ~+10% | ~+36% | ~$200B | WFE, advanced packaging | LRCX |
| LRCX | Lam Research | ~+25% | ~+47-61% | ~$130B | Etch/deposition leader, memory ramp | AMAT |
| KLAC | KLA | ~+25% | ~+25% | ~$110B | Process control / metrology | LRCX |

### Memory
| Ticker | Co | 2025 % | YTD 2026 % | MktCap | One-liner | Paired comparable |
|---|---|---|---|---|---|---|
| 000660.KS | SK Hynix | ~+200% | ~+259% | >$1T | HBM3E/4 dominance, sold-out 2026 | Samsung Memory |
| 005930.KS | Samsung Elec | ~+50% | ~+160% | >$1T | HBM4E sample lead, foundry/memory | SK Hynix |
| MU | Micron | ~+85% | ~+200%+ | ~$370B | HBM3E ramp, 132% YoY rev growth | SK Hynix |
| SNDK | Sandisk | ~+559% (post-spin) | ~+592% | ~$240B | NAND pure-play, AI supply deals | WDC |
| WDC | Western Digital | ~+150% | ~+208% | ~$130B | HDD/SSD post-spin parent | STX, SNDK |
| 285A.T | Kioxia | ~+200% | ~+150% | ~$30B | NAND, JV with Sandisk | SNDK |

### Inference / AI chip startups
| Ticker | Co | 2025 % | YTD 2026 % | MktCap | One-liner | Paired comparable |
|---|---|---|---|---|---|---|
| CRBS | Cerebras (IPO May 2026) | n/a private | IPO @ $150 ($48B val) | ~$48B | Wafer-scale inference; OpenAI deal | (Groq, NVDA inference) |
| (private) | Groq | acquired by NVDA $20B | n/a | n/a | LPU inference (now in Nvidia stack) | NVDA inference SKUs |

### Datacenter REITs / Power / Cooling
| Ticker | Co | 2025 % | YTD 2026 % | MktCap | One-liner | Paired comparable |
|---|---|---|---|---|---|---|
| DLR | Digital Realty | ~+15% | ~+28% | ~$70B | Hyperscale wholesale DC REIT | EQIX |
| EQIX | Equinix | ~+10% | ~+40% | ~$106B | Colocation/interconnect leader | DLR |
| VRT | Vertiv | ~+90% | ~+115% | ~$140B | Liquid cooling pure-play | ETN |
| ETN | Eaton | ~+25% | ~+15% (est) | ~$160B | Electrical infra + Boyd cooling | VRT |
| SU.PA | Schneider Electric | ~+15% | ~+20% (est) | ~€180B | Global elec/DC infra | ETN |
| ABBN.SW | ABB | ~+15% | ~+10% (est) | ~$95B | Electrification/automation | SU.PA |
| GNRC | Generac | ~+25% | ~+98% | ~$17B | Backup power / generators for DC | VRT |
| MOD | Modine | ~+150% | ~+63% | ~$15B | Cooling/HVAC, DC pure-play spin | VRT |
| NVT | nVent | ~+50% | ~+31% | ~$25B | Liquid cooling, white/gray space | MOD |

### Energy — Nuclear / IPP
| Ticker | Co | 2025 % | YTD 2026 % | MktCap | One-liner | Paired comparable |
|---|---|---|---|---|---|---|
| CEG | Constellation | ~+90% | ~-5% (re-rated) | ~$100B | Largest US nuclear fleet, MSFT deal | VST |
| VST | Vistra | ~+265% | ~+5% (est) | ~$70B | TX gas+nuke, Calpine integration | CEG |
| TLN | Talen | ~+220% | ~+15% (est) | ~$20B | Susquehanna AMZN colocation | CEG, VST |
| CCJ | Cameco | ~+40% | ~+25% (est) | ~$45B | Uranium upstream, Westinghouse stake | LEU |
| OKLO | Oklo | ~+250% | ~+35%+ | ~$15B | Fast-reactor SMR, Sam Altman-backed | SMR, NNE |
| SMR | NuScale | ~+450% | ~+35%+ | ~$10B | Light-water SMR pioneer | OKLO |
| BWXT | BWXT | ~+50% | ~+25% (est) | ~$15B | Naval/SMR nuclear components | LEU |
| LEU | Centrus | ~+200% | ~+18% | ~$3B | HALEU enrichment monopoly US | BWXT |
| XE | X-energy (IPO Apr 2026) | private | IPO @ $23 ($9.1B val) | ~$9B | Pebble-bed SMR, Amazon-backed | SMR, OKLO |

### Energy — Gas turbines
| Ticker | Co | 2025 % | YTD 2026 % | MktCap | One-liner | Paired comparable |
|---|---|---|---|---|---|---|
| GEV | GE Vernova | ~+150% | ~+30% (est, hit ATH $1182) | ~$300B | 83GW gas turbine backlog, sold out | Siemens Energy |
| ENR.DE | Siemens Energy | ~+220% | ~+40% (est) | ~€110B | Gas turbines, grid | GEV |
| 7011.T | Mitsubishi Heavy | ~+80% | ~+25% (est) | ~¥10T | Gas turbines, doubling capacity | GEV |

### Grid / Power services
| Ticker | Co | 2025 % | YTD 2026 % | MktCap | One-liner | Paired comparable |
|---|---|---|---|---|---|---|
| PWR | Quanta Services | ~+50% | ~+38% (6mo) | ~$70B | Transmission build pure-play | MTZ |
| MTZ | MasTec | ~+65% | ~+50% (6mo) | ~$15B | Fiber/transmission/DC turnkey | PWR |
| HUBB | Hubbell | ~+10% | ~+20% (est) | ~$25B | Grid components, transformers | PWR |

### Networking / Optics
| Ticker | Co | 2025 % | YTD 2026 % | MktCap | One-liner | Paired comparable |
|---|---|---|---|---|---|---|
| ANET | Arista | ~+25% | ~+20% (est) | ~$170B | Ethernet AI back-end (Meta/MSFT) | CSCO |
| CSCO | Cisco | ~+15% | ~+10% (est) | ~$470B | Splunk, $3B FY26 AI hyperscaler rev | ANET |
| COHR | Coherent | ~+70% | ~+97% | ~$60B | Transceivers, NVDA $2B investment | LITE |
| LITE | Lumentum | ~+150% | ~+166% | ~$60B | Optical, $400M OCS backlog | COHR |
| ALAB | Astera Labs | ~+90% | ~+25% (est) | ~$60B | Scorpio X-series, PCIe AI fabrics | CRDO |
| CRDO | Credo | ~+200% | ~+30% (est) | ~$35B | AECs, 272% YoY revenue | ALAB |

### Demand (Hyperscalers / megacaps)
| Ticker | Co | 2025 % | YTD 2026 % | MktCap | One-liner | Paired comparable |
|---|---|---|---|---|---|---|
| MSFT | Microsoft | ~+20% | ~-17% (Feb) → flat | ~$3.2T | $190B FY26 capex, Azure 40% growth | GOOGL |
| GOOGL | Alphabet | ~+30% | ~+10% (est) | ~$2.5T | $460B GCP backlog, TPU vertical | MSFT |
| AMZN | Amazon | ~+40% | ~-9% (Feb) → ~+5% | ~$2.3T | $200B capex, Trainium, $17B neg FCF | MSFT |
| META | Meta | ~+65% | ~+5% (est) | ~$1.7T | $125-145B capex, MTIA chips | GOOGL |
| ORCL | Oracle | ~+60% | ~+15% (est, after May rally) | ~$700B | $30B US gov AI deal, OpenAI/MSFT/META | MSFT |
| AAPL | Apple | ~+30% | ~-5% (est) | ~$3.5T | Late on AI, lagging hyperscalers | MSFT |
| TSLA | Tesla | ~+60% | ~-10% (est) | ~$1.0T | Robotaxi/FSD lawsuit overhang | (AV peers) |

### Enterprise servers
| Ticker | Co | 2025 % | YTD 2026 % | MktCap | One-liner | Paired comparable |
|---|---|---|---|---|---|---|
| DELL | Dell | ~+50% | ~+234% | ~$310B | $16B AI server qtr, $60B FY27 guide | SMCI |
| SMCI | Super Micro | ~-40% | ~-7% | ~$28B | Governance/share loss to DELL | DELL |
| HPE | HPE | ~+15% | ~+20% | ~$45B | ProLiant + Juniper, +152% net rev | DELL |

### Neoclouds
| Ticker | Co | 2025 % | YTD 2026 % | MktCap | One-liner | Paired comparable |
|---|---|---|---|---|---|---|
| CRWV | CoreWeave | n/a (Mar 2025 IPO) | ~+70% TTM | ~$60B | MSFT-dependent, $100B contracted | NBIS |
| NBIS | Nebius | ~+200% | ~+250%+ (TTM +444-510%) | ~$50B | Meta/MSFT $50B backlog, cleaner BS | CRWV |

### Taiwan ODMs
| Ticker | Co | 2025 % | YTD 2026 % | MktCap | One-liner | Paired comparable |
|---|---|---|---|---|---|---|
| 2317.TW | Foxconn/Hon Hai | ~+80% | ~+30% (est) | ~NT$3T | NVL72 main assembler | Quanta |
| 2382.TW | Quanta Computer | ~+90% | ~+25% (est) | ~NT$1.5T | NVL36 main; Meta partner | Wiwynn |
| 6669.TW | Wiwynn | ~+150% | ~+50% (est) (+148.9% YoY rev) | ~NT$650B | ASIC racks dominant supplier | Quanta |
| 2356.TW | Inventec | ~+50% | ~+15% (est) | ~NT$200B | Base-config, less AI exposure | Wistron |

### BMC / Substrate / PCB
| Ticker | Co | 2025 % | YTD 2026 % | MktCap | One-liner | Paired comparable |
|---|---|---|---|---|---|---|
| 5274.TW | ASPEED | ~+200% | ~+475% (TWD 2990→17195) | ~NT$160B | BMC monopoly for AI servers | (none) |
| 2802.T | Ajinomoto | ~+30% | ~+15% (est) | ~¥5.3T | ABF film 90% market share | Ibiden |
| 4062.T | Ibiden | ~+10% | ~+5% (est, MS Underweight) | ~¥1.5T | ABF substrates, conservative | Unimicron |
| 3037.TW | Unimicron | ~+50% | ~+194% (per MS upgrade) | ~NT$700B | ABF substrates AI ramp | Ibiden |
| TTMI | TTM Tech | ~+80% | ~+30% (est) | ~$5B | PCB for AI/defense | Unimicron |

### Power management
| Ticker | Co | 2025 % | YTD 2026 % | MktCap | One-liner | Paired comparable |
|---|---|---|---|---|---|---|
| MPWR | Monolithic Power | ~+60% | ~+69% | ~$75B | Vertical power for GPUs | VICR |
| TXN | Texas Instruments | ~+5% | ~-3% (est) | ~$170B | Analog scale leader, slower AI | ADI |
| ADI | Analog Devices | ~+10% | ~+5% (est) | ~$120B | High-precision analog | TXN |
| VICR | Vicor | ~+200% | ~+25% (est, Q2 raise) | ~$5B | 48V VPD for AI racks | MPWR |
| 2308.TW | Delta Electronics | ~+90% | ~+40% (est) | ~NT$1.5T | Server PSUs, cooling | Vertiv |
| IFX.DE | Infineon | ~+15% | ~+10% (est) | ~€55B | Power semis | TXN |

### Connectors
| Ticker | Co | 2025 % | YTD 2026 % | MktCap | One-liner | Paired comparable |
|---|---|---|---|---|---|---|
| APH | Amphenol | ~+98% | ~-5% (gave back early gains) | ~$100B | IT datacom 41% of sales, CommScope | TEL |
| TEL | TE Connectivity | ~+25% | ~-9% | ~$45B | Auto-heavy, weaker AI ramp | APH |

### Storage alternatives
| Ticker | Co | 2025 % | YTD 2026 % | MktCap | One-liner | Paired comparable |
|---|---|---|---|---|---|---|
| STX | Seagate | ~+150% | ~+190% | ~$187B | HAMR HDD, exabyte boom | WDC |
| PSTG | Pure Storage | ~+45% | ~flat | ~$26B | DirectFlash hyperscaler ramp | NTAP |
| NTAP | NetApp | ~-10% | ~-15% (TTM -19.8%) | ~$23B | Public sector/EMEA drag | PSTG |

### Utilities (laggards group)
| Ticker | Co | 2025 % | YTD 2026 % | MktCap | One-liner | Paired comparable |
|---|---|---|---|---|---|---|
| PEG | PSEG | ~+15% | ~+5% (est, lagging) | ~$45B | NJ utility, PJM DC angle | ETR |
| DUK | Duke | ~+15% | ~+8% (est) | ~$120B | $102B capex thru 2030 | SO |
| SO | Southern | ~+25% | ~+10% (est) | ~$110B | $81B capex, Meta/MSFT exposure | DUK |
| EXC | Exelon | ~+15% | ~+5% (est) | ~$40B | Pure-T&D, cautious growth | DUK |
| D | Dominion | ~+10% | ~+15% (NEE bid pop) | ~$56B | NoVa DC capital; NEE merger target | ETR |
| ETR | Entergy | ~+30% | ~+18-25% | ~$50B | Meta deal, $57B capex, +33% | NEE |
| AES | AES | ~-20% | ~+17% (3mo) | ~$10B | Cheap, 4.3% yield, DC PPAs | NRG |
| NRG | NRG | ~+60% | ~-15% (off highs) | ~$30B | LS Power acquisition, 25GW | VST |
| NEE | NextEra | ~+5% | ~+16% (then -4% on D deal) | ~$197B | Renewables + nuke; Dominion bid | ETR |

### Specialty alloys
| Ticker | Co | 2025 % | YTD 2026 % | MktCap | One-liner | Paired comparable |
|---|---|---|---|---|---|---|
| CRS | Carpenter | ~+90% | ~+44% | ~$22B | Aerospace + IGT alloy demand | ATI |
| ATI | ATI | ~+70% | ~+36% | ~$21B | Titanium, hafnium specialty | CRS |
| HWM | Howmet | ~+80% | ~+40% (est) | ~$120B | Aerospace + 32% IGT gas turbine | CRS |

### Quantum / photonics
| Ticker | Co | 2025 % | YTD 2026 % | MktCap | One-liner | Paired comparable |
|---|---|---|---|---|---|---|
| IONQ | IonQ | ~+670% | ~+16% (only positive) | ~$15B | Trapped-ion, SkyWater foundry | RGTI |
| RGTI | Rigetti | ~+6,217% | ~-10% to -24% | ~$5B | Superconducting; missed Q4 | QBTS |
| QBTS | D-Wave | ~+3,912% | ~-9% to -26% | ~$4B | Annealing; 83% gross margin | RGTI |

### EDA
| Ticker | Co | 2025 % | YTD 2026 % | MktCap | One-liner | Paired comparable |
|---|---|---|---|---|---|---|
| CDNS | Cadence | ~+30% | ~+15% | ~$100B | Chip design tools, AI IP +22% | SNPS |
| SNPS | Synopsys | ~+10% | ~+10% (est) | ~$95B | EDA + Ansys merger, China overhang | CDNS |

### Bitcoin miner AI pivots
| Ticker | Co | 2025 % | YTD 2026 % | MktCap | One-liner | Paired comparable |
|---|---|---|---|---|---|---|
| WULF | TeraWulf | ~+150% | ~+74% (sector leader) | ~$8B | $12.8B AI contracts locked | HUT |
| HUT | Hut 8 | ~+200% | ~+68% | ~$8B | Anthropic/Fluidstack/Google deal | WULF |
| IREN | Iris Energy | ~+496% | ~+40% (est, MSFT $9.7B deal) | ~$14B | All-renewable AI factories | CORZ |
| APLD | Applied Digital | ~+250% | ~+40%+ | ~$8B | Polaris Forge HPC datacenters | CORZ |
| CORZ | Core Scientific | ~+150% | ~+40%+ | ~$7B | Sold $175M BTC for AI pivot | APLD |
| BTBT | Bit Digital | ~+100% | ~+20% (est) | ~$2B | Smaller AI/HPC pivot | CORZ |

### Robotics
| Ticker | Co | 2025 % | YTD 2026 % | MktCap | One-liner | Paired comparable |
|---|---|---|---|---|---|---|
| SYM | Symbotic | ~+30% | ~-30% (est, down 21% past mo) | ~$5B | Warehouse robots, volatile | ROK |
| ROK | Rockwell | ~+15% | ~+1.4% | ~$50B | Industrial auto; no AI re-rate | SYM |

### AV (autonomous vehicles)
| Ticker | Co | 2025 % | YTD 2026 % | MktCap | One-liner | Paired comparable |
|---|---|---|---|---|---|---|
| MBLY | Mobileye | ~-30% | ~-2.5% | ~$15B | ADAS chip; Q1 beat, 29% 1mo bounce | AUR |
| AUR | Aurora | ~+80% | ~+90% | ~$15B | Driverless freight commercial start | MBLY |
| PONY | Pony.ai | post-IPO ~+50% | ~-40% | ~$3B | Robotaxi growth ignored, 52-wk low | AUR |

## Comparable-pair divergences

1. **SNDK +592% YTD vs WDC +208% YTD** — Both NAND/HDD; the spinoff (SNDK) has tripled the parent (WDC), the cleanest "AI pure-play premium" trade of 2026. NAND scarcity > HDD scarcity even after WDC's huge run.
2. **AUR +90% YTD vs MBLY -2.5% YTD vs PONY -40% YTD** — Three AV plays, ~130 point spread. Aurora's commercial driverless freight launch (McLane) re-rated it; Mobileye/Pony AI's robotaxi growth ignored.
3. **DELL +234% YTD vs SMCI -7% YTD** — ~240 point spread between AI server peers. Hyperscalers migrated share to Dell amid SMCI governance overhang; Dell's $16B AI server qtr and $60B FY27 guide validated the rotation.
4. **APH -5% YTD vs TEL -9% YTD** — Both AI connector plays, but Amphenol had already gone +98% in early-2026 wave before giving back; TE never caught the bid (more auto exposure, slower AI ramp). Pair is a "reversal trade" inside the connector space.
5. **NBIS +250%+ YTD vs CRWV +0% YTD (TTM ~+70%)** — Both neoclouds; Nebius re-rated on cleaner balance sheet (2.1x D/E) and 684% YoY rev vs CoreWeave's 10.7x D/E and Microsoft customer concentration risk.
6. **VRT +115% YTD vs ETN +15% YTD** — Both DC power/cooling. Vertiv's liquid-cooling pure-play outpaced diversified Eaton 8:1, despite Eaton's Boyd acquisition trying to close the gap.
7. **LITE +166% YTD vs COHR +97% YTD** — Both AI optical/transceivers, both winners, but Lumentum's optical-circuit-switch backlog ($400M) drove a wider rerate; Coherent's industrial cycle exposure capped multiple.
8. **CEG -5% YTD vs ETR +18-25% YTD** — Both AI-power utilities. CEG had a 2025 monster run (+90%) and is now multiple-compressing; Entergy is the new "Meta-deal" catalyst leader. Rotation within nuclear-utility complex from CEG → ETR/VST.
9. **GNRC +98% YTD vs NVT +31% YTD vs MOD +63% YTD** — Three DC "picks and shovels" plays, GNRC pulled away on Jefferies upgrade + $400M DC backlog despite being smallest. Modine close behind on pure-play DC HVAC spin.
10. **ASPEED +475% YTD (TWD 2990→17195) vs Ibiden +5% YTD** — Two Asian AI-server-pick names: ASPEED is the BMC monopoly that everyone needs; Ibiden's ABF substrates run cooled (MS Underweight). Most extreme pair divergence in entire dashboard.
11. **IONQ +16% YTD vs RGTI -10-24% YTD vs QBTS -9-26% YTD** — Quantum trio: 2025 was indiscriminate (+670% to +6,217%); 2026 is bifurcating on revenue execution. IonQ's $260-270M guide vs Rigetti's Q4 miss.
12. **WULF +74% YTD vs HUT +68% YTD vs others ~+40%** — BTC miner pivot trade: WULF/HUT lead on highest-quality offtake (Google/Fluidstack/Anthropic, JPM/GS financing). Quality of hyperscaler counterparty is now the alpha factor, not just power capacity.

_new_nodes_suggested:
- B12-cerebras-ipo-deep-dive — analyze SRAM-vs-DRAM inference economics post-Cerebras IPO and OpenAI warrants
- B12-sndk-wdc-spinoff-mechanics — explain why the NAND spinoff captured 3x more AI-supply-cycle premium than the parent
- B12-asml-ueve-vs-china-overhang — separate ASML's EUV moat from China export ceiling, given KLA/LRCX outperforming
- B12-entergy-meta-grid-deal — financial mechanics of the $57B Entergy capex / Meta data-center build
- B12-quantum-revenue-divergence-2026 — track IonQ vs RGTI/QBTS through 2026 milestone events

## Sources
- [AMD 2026 outperformance vs NVDA](https://www.heygotrade.com/en/blog/amd-stock-analysis-2026-how-amd-quietly-outperformed-nvidia-with-114-gain/)
- [Broadcom AVGO YTD 2026](https://stockanalysis.com/stocks/avgo/)
- [Intel INTC turnaround 2026](https://www.financecharts.com/stocks/INTC/performance/total-return)
- [Arm Holdings 2026 surge](https://www.startuphub.ai/ai-news/ai-stocks-daily/2026/ai-stocks-2026-05-20)
- [TSM ASML AMAT LRCX KLAC YTD](https://www.tradingview.com/news/zacks:53da8b6b4094b:0-asml-holding-rises-23-1-ytd-time-to-buy-sell-or-hold-the-stock/)
- [Sandisk +592% YTD S&P winner](https://stocktwits.com/news-articles/markets/equity/san-disk-outperforms-western-digital-with-600-ytd-gain-climbed-to-top-of-s-and-p-500-winners-list/cLICWXGREFL)
- [SK Hynix +259% YTD memory supercycle](https://www.ibtimes.com.au/samsung-sk-hynix-ai-memory-chip-boom-2026-1869727)
- [Micron HBM ramp](https://www.benzinga.com/markets/tech/26/05/52811262/micron-vs-sk-hynix-best-memory-stock-2026)
- [Vertiv +115% YTD AI cooling](https://markets.financialcontent.com/stocks/article/finterra-2026-2-11-the-architecture-of-ai-a-deep-dive-into-vertiv-holdings-vrt-following-record-2026-results)
- [Constellation CEG vs Vistra VST 2026](https://www.lambdafin.com/articles/vistra-vs-constellation-vs-talen)
- [Nuclear stocks early 2026 update](https://www.etftrends.com/nuclear-energy-content-hub/powering-on-nuclear-stocks-strong-start-2026/)
- [Cameco BWXT LEU SMR OKLO](https://www.insidermonkey.com/blog/10-best-nuclear-energy-stocks-to-buy-as-smrs-go-mainstream-1761864/)
- [GE Vernova GEV ATH](https://www.investing.com/news/stock-market-news/ge-vernova-hits-record-high-on-bullish-2026-revenue-outlook-buyback-boost-4401299)
- [Quanta MasTec Hubbell AI infra](https://finance.yahoo.com/markets/stocks/articles/quanta-vs-mastec-ai-infrastructure-145000521.html)
- [Lumentum +166% Coherent +97% optical AI](https://www.tikr.com/blog/lumentum-and-coherent-nasdaq-stocks-climb-following-bullish-analyst-coverage-on-ai-networking-demand)
- [Hyperscaler $700B 2026 capex](https://finance.yahoo.com/sectors/technology/articles/hyperscalers-hit-700-billion-2026-111243744.html)
- [Oracle ORCL AI rally May 2026](https://www.timothysykes.com/news/oraclecorporation-orcl-news-2026_05_29/)
- [Dell +234% YTD AI server boom](https://247wallst.com/investing/2026/05/29/dell-technologies-surges-33-on-ai-server-boom-super-micro-computer-adds-16-as-hyperscaler-spend-accelerates/)
- [Nebius vs CoreWeave neoclouds](https://www.fool.com/coverage/better-buy/2026/05/22/coreweave-vs-nebius-which-artificial-intelligence-ai-infrastructure-stock-is-a-better-buy-in-2026/)
- [Taiwan ODM Foxconn Quanta Wiwynn](https://www.digitimes.com/news/a20260210PD205/taiwan-ai-server-odm-demand-supply-chain-2026.html)
- [Unimicron Morgan Stanley upgrade](https://www.investing.com/news/stock-market-news/morgan-stanley-upgrades-unimicron-nypcb-on-ailed-abf-substrate-upcycle-4519224)
- [ASPEED 5274 +475% YTD](https://www.bloomberg.com/quote/5274:TT)
- [Monolithic Power MPWR +69% YTD](https://simplywall.st/community/narratives/us/semiconductors/nasdaq-mpwr/monolithic-power-systems/cafbznfq-monolithic-power-systems-mpwr-the-ai-power-architect-at-all-time-highs)
- [Amphenol APH gives back gains](https://finance.yahoo.com/markets/stocks/articles/amphenol-drops-12-month-buy-173800510.html)
- [Seagate +190% YTD HDD AI](https://stockanalysis.com/stocks/stx/)
- [NetApp NTAP lagging storage](https://finance.yahoo.com/news/seagate-vs-netapp-data-storage-131900597.html)
- [NextEra-Dominion deal](https://www.cnbc.com/2026/05/18/nextera-nee-dominion-energy-d-data-center-ai.html)
- [Entergy Meta data center $57B capex](https://finance.yahoo.com/sectors/energy/articles/why-entergy-etr-expanding-grid-173015049.html)
- [Carpenter CRS ATI +36-44% YTD](https://tickeron.com/compare/ATI-vs-CRS/)
- [Quantum 2026 IonQ leads](https://247wallst.com/investing/2026/05/06/which-quantum-computing-stock-has-dominated-in-2026-ionq-rigetti-or-d-wave/)
- [Cadence CDNS +15% YTD AI design](https://www.tikr.com/blog/cadence-design-systems-stock-is-up-15-year-to-date-heres-why-the-ai-chip-design-boom-could-drive-more-gains)
- [BTC miners +70% beating bitcoin 2026](https://news.bitcoin.com/miners-beat-bitcoin-by-70-in-2026-as-terawulf-locks-12-8b-in-ai-contracts/)
- [Aurora +90% MBLY -2.5% PONY -40%](https://stockstotrade.com/news/aurora-innovation-inc-aur-news-2026_05_28/)
- [DLR EQIX GNRC MOD NVT DC stocks](https://www.tikr.com/blog/nvent-electric-q1-2026-earnings-revenue-surges-53-on-ai-data-center-demand)
- [Cerebras $48B IPO May 2026](https://www.investing.com/analysis/cerebras-48-billion-ipo-tests-the-markets-inference-bet-200680080)
- [X-energy IPO ticker XE Apr 2026](https://x-energy.com/news/x-energy-announces-pricing-of-upsized-initial-public-offering/)
- [AES Entergy NRG utility AI exposure](https://www.nasdaq.com/articles/aes-vs-entergy-which-utility-stock-offers-better-growth)
- [Cerebras-Groq inference battle](https://www.morningstar.com/stocks/why-ai-chip-designer-cerebras-is-2026s-hottest-ipo-yet)