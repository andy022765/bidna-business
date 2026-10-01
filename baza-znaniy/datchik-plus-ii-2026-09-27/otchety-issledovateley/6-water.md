I have 7 candidates, and the brief is widened to worldwide. Two things limited the checks. Google Patents returned 503 for the whole session, so I read patents as full-text USPTO PDFs, OCR'd with a local Swift tool. The arXiv API throttled me with 429 part of the time, so I also found papers through WebSearch on arxiv.org and opened each one at arxiv.org/abs. I ran about 52 arXiv API queries (the API returns up to 15 results per query) plus about 12 through search. For patents I ran about 15 search queries and opened about 25 PDFs. For patent families I could only check the PCT/foreign-priority fields on the front page. Espacenet and PatentScope answered 403, so I did not verify national phases, except EP3980728 for Orbis.

---

## 1. Legionella "thermal twin" for building hot water (and cooling towers as an add-on)

1. **What it is.** Clamp-on temperature probes on pipes and at outlets, plus ML, turn a manual log into a continuous risk score for each outlet. The system also infers from the temperature curve when a tap was actually used or flushed.
2. **How to build it.** Put DS18B20 probes on the heater outlet, the return loop and the "sentinel" outlets. Connect them through LoRaWAN nodes and one gateway per building. The models:
   - A soft sensor for flow events: a sharp temperature change at the outlet means the tap was opened. This removes the need for a flow meter on every tap.
   - Per-outlet features: time in the 25–45 °C range, time since the last flush, and how fast the loop cools.
   - A gradient-boosting or survival model that ranks outlets by risk. It is calibrated against the facility's periodic lab tests.
   - Automatic flush lists and a PDF log for inspections.
   
   Everything runs in the cloud; the node only sends data.
3. **Hardware and price.**
   - DS18B20: about $2–4.
   - Dragino LHT65N (LoRaWAN with an external DS18B20): about $30–45 (it launched at about $30 in 2019).
   - Gateway: about $150–250 per building (my estimate).
   - Total: about $20–45 per monitoring point.
   - Temperature does not drift, and that is the main advantage over every other idea here. What actually fails is thermal contact on the pipe and the battery (2400 mAh, up to about 10 years according to Dragino).
4. **Customers.** Hospitals and nursing homes in the US (CMS QSO-17-30 requires a water management program, and ASHRAE 188), hotels, senior living, dialysis and dental clinics. Also property managers of multi-family buildings.
5. **Where in the world.**
   - UK, the strongest pull: HSG274 requires monthly temperature checks at sentinel outlets, and those checks are done by hand. Competitors: AQUAIOT, IWS Realtime Online, TE Compliance, HBE24, SmarterWater.
   - Germany: TrinkwV 2023 requires a Legionella test every 3 years in large hot-water systems, with an action value of 100 CFU/100 ml. Schell SWS and Kemper sell networked automatic flushing valves.
   - EU: Directive 2020/2184 sets 1000 CFU/L and a risk-based approach for priority premises.
   - Also hotels in the Gulf, and cooling towers in Singapore and Hong Kong. In the US, HC Info LAMPS is compliance software.
6. **Sources.**
   - Patent US11815272B2, Intellihot Inc. (priority 2019). Claim 1 flags risk when water spends more than about 50% of a period in the growth range. Claim 6 flags risk when flow per period is below a threshold, followed by replacing the water. These claims are fairly broad. I found no WO/EP filing, and the front page shows only a US provisional, so this is a **US-only** FTO risk.
   - Patents US11150154B2, US11566957B2, US11698314B2 and US12152954B2, Orbis Intelligent Systems (2019–2020). Their claims cover acoustic sensors and accelerometers on the pipe; Legionella appears only in the description, 86 times. **EP3980728 has been granted** (from WO2020/247984).
   - Seen in search results but not opened: EP3243080A1 (detecting flow from temperature dips) and DE102007009007B4.
   - Peer-reviewed paper (not arXiv): Whiley et al. 2019, IJERPH, PMC6518245. It used 220 temperature sensors on thermostatic mixing valves for 3 years, inferred flow events from temperature alone, and found flushing frequency inversely correlated with bacterial load (rs = −0.188).
   - arXiv has almost nothing on this topic. The generic anomaly-detection method is arXiv 1810.13076, "A framework for automated anomaly detection in high frequency water-quality data from in situ sensors".
7. **Maturity and risks.**
   - The hardware is mature. Competitors are mostly threshold alarms, so the gap is in ML scoring and in inferring flushes from temperature.
   - Risk 1: the temperature–Legionella link is statistical. The system does not detect bacteria, so it cannot replace lab testing.
   - Risk 2: the Intellihot claims in the US.
   - Regulatory flag, US: the product sits under ASHRAE 188 and CMS as monitoring and documentation for the program. Legionella culture must come from an accredited lab.
   - Rest of world: UK ACoP L8/HSG274, Germany TrinkwV (sampling only by approved labs), EU Directive 2020/2184, and WHO water safety plans.
8. **Recommendation.** Sell a monthly service per building: "we automate your monthly temperature log and flush list". Channels are water-hygiene contractors (in the UK they are the main channel) and facility management firms. A pilot is one building with 30–50 points.

## 2. Copilot for RO refill stations, water ATMs and vending machines (plus commercial point-of-use filter fleets)

1. **What it is.** Remote monitoring of small RO plants that sell water. The ML forecasts membrane and filter life and catches UV lamp and TDS problems before a customer or an inspector does. It also keeps the service and compliance log.
2. **How to build it.** Sensors: TDS/EC on feed and permeate, two flow meters, pressure before and after the membrane, water temperature, a current sensor on the UV lamp, and GSM/LTE-M. The model:
   - Normalized permeate flow and salt passage, normalized for temperature and pressure.
   - A remaining-useful-life estimate for the membrane from a health index; the method follows arXiv 2602.00659.
   - Anomaly detection with an autoencoder or isolation forest for leaks, a dead lamp, or a filter bypass.
   - Maintenance routes for a fleet of machines.
3. **Hardware and price.**
   - ESP32: about $5–10.
   - DFRobot SEN0244 TDS: $11.80 each, 2 needed.
   - YF-S201 flow meter: about $5–10 each, 2 needed.
   - Pressure transducers: about $10–20 each, 2 needed (estimate).
   - SCT-013 current clamp: about $5–10.
   - LTE-M modem: about $15–30.
   - Total: about $80–140.
   - Drift: TDS probes scale up, so check them quarterly against a 1413 µS/cm standard. Hall-effect flow meters clog in hard water. Pressure transducers are stable.
4. **Customers.**
   - US: California water vending machines. Title 17 §7865 requires coliform testing by a certified lab at least every 6 months, sanitizing every 31 days with a record of every visit, and a TDS check at every service for "purified" water, with a limit of 10 mg/L.
   - Commercial filters in restaurants, coffee shops, dental clinics and offices, sold through dealers.
5. **Where in the world.**
   - Philippines: water refilling stations need a monthly bacteriological test.
   - Indonesia: more than 20,000 DAMIU refill depots.
   - Mexico: purificadoras (I did not find a count).
   - India: community RO plants and water ATMs, for example Piramal Sarvajal. The household segment is taken by DrinkPrime (IoT RO on subscription from ₹299–349 a month, 100,000+ subscribers).
   - Ukraine: street water vending machines. In Mykolaiv, Dez Pilot runs about 100 decentralized RO units serving about 200 points after the pipeline was destroyed in 2022.
   - Kenya and Nigeria: water ATMs (Grundfos AQtap is a known player; I did not check it in this session).
6. **Sources.**
   - arXiv 2009.03645, "Detection of Anomalies and Faults in Industrial IoT Systems by Data Mining: Study of CHRIST Osmotron Water Purification System": 6 sensors, SVM plus an unsupervised neural network.
   - arXiv 2602.00659, "Predictive Maintenance for Ultrafiltration Membranes Using Explainable Similarity-Based Prognostics": a health index from transmembrane pressure, flux and resistance; mean absolute error 4.50 cycles.
   - Patent US11484843B2, Doosan Enerbility (KR priority 2019). Claim: salt removal and pressure drop, then normalization, then prediction, then clean-in-place. Aimed at medium and large plants. **The KR family is likely; I found no WO.**
   - Patent US11938450B1, Surplus Management Inc (2023). **US only** (a B1 grant with no PCT).
   - Patent US11992803B2, Schlumberger (2018): membrane remaining life from a physical model. **WO2020/023956 exists; national phases not verified.**
   - Comparing TDS in and out is old prior art (US4937557, seen in search results).
7. **Maturity and risks.**
   - The technology is simple. The difficulty is operational: the operator has to act on the alert, and prepaid connectivity costs money.
   - India: the Supreme Court stayed the NGT order that would have banned RO where TDS is below 500 mg/L, but the issue is not settled.
   - Regulatory flag, US: claims such as "safe water" or contaminant reduction need NSF/ANSI 58/61 certification or state licensing. The monitoring itself is operational and does not replace lab testing.
   - Rest of world: India BIS IS 10500 and IS 16240 (the RO standard), Philippines PNSDW plus the DOH monthly test, Mexico NOM-201-SSA1 (to be confirmed), Ukraine ДСанПіН 2.2.4-171-10 (moving toward the EU Drinking Water Directive), WHO drinking-water guidelines.
8. **Recommendation.** Sell a white-label kit to equipment makers and franchises: Puritec and Puritronic in Mexico, Inviro and Nirvana in Indonesia, and similar. Or sell directly to operators with 10–100 machines. Offer a compliance log in the local format plus "fewer trips and longer membrane life".

## 3. Commercial pools and spas: free-chlorine soft sensor, dosing forecasts and a health-code log

1. **What it is.** Estimate free chlorine from ORP, pH, temperature and cyanuric acid, forecast chlorine demand (sun, bather load), and detect a dying probe. Produce the inspection log automatically.
2. **How to build it.** Where the pool already has a controller (Chemtrol, BECS, Hayward CAT, typically on public pools), read it over RS-485/Modbus. Otherwise use your own probes. The models:
   - A regression from ORP to free chlorine, recalibrated after each manual DPD test.
   - Forecasting with weather and occupancy.
   - Drift detection, following the approach of arXiv 2501.02107.
3. **Hardware and price.**
   - Controller gateway: about $30–60 (estimate).
   - Your own probes: DFRobot ORP SEN0165 at $89 or SEN0464 at $129, pH V2 at $49.83, plus ESP32. Total about $150–200.
   - Honestly, pH probes need recalibration every 2–4 weeks and last about 12–18 months (my estimate). ORP probes need cleaning.
4. **Customers.** Hotels, homeowners associations and apartment complexes, gyms, and pool-service companies with routes. The CDC reviewed 84,000 inspections in 2013: about 80% had at least one violation, 1 in 8 led to immediate closure, 15% involved pH and 12% involved disinfectant. The US Model Aquatic Health Code requires a manual free-chlorine and pH test every 4 hours even when an automated controller is installed.
5. **Where in the world.**
   - France and Spain: the largest private-pool markets in Europe. Competitors: Blue Riiot / Blue Connect (80% owned by Fluidra since 2017), Flipr (France, 20,000+ pools), iopool (Belgium), Ondilo ICO (France).
   - Germany: DIN 19643 requires continuous measurement of chlorine, pH and redox in public pools.
   - UK: PWTAG. Also Australia and hotels in the Gulf.
   - Warning: consumer monitors are a graveyard. pHin (Hayward) was shut down in December 2021. Sutro, according to a retail listing, stopped working on October 31, 2025. WaterGuru is alive (the S2 at about $95–110, earlier $295, plus cassettes at about $20 every 4–8 weeks).
6. **Sources.**
   - Patent US11352266B2, Evoqua Water Technologies GmbH (2017). Claim: a "quality factor" equal to √(measured free chlorine ÷ an ORP-dependent chlorine reference value), then control of recirculation and dosing. This is directly adjacent to the soft sensor. **WO2019/030232 exists, so EP is likely; not verified.**
   - Patents US10604954B2 and US11162272B2, WaterGuru (2015). Claims are narrow: test pads in a sealed cartridge and dosing from packets. WO2016/176169.
   - Patent US10577256B2, Sutro Connect (2017): a reagent cartridge with photometry.
   - US20190136557A1, a smart skimmer with ML in the cloud (Jensen and Higgins, individual applicants).
   - WO2018122857A1, ML recommendations for pool care: seen only as a search snippet; not opened.
   - arXiv 2303.07195, "Operating data of a specific Aquatic Center as a Benchmark…": energy only.
   - arXiv 2501.02107, "Online Detection of Water Contamination Under Concept Drift": an LSTM variational autoencoder that treats chlorine-sensor offset as concept drift.
7. **Maturity and risks.**
   - The market is crowded. Only the B2B layer on top of existing controllers makes sense.
   - Probes drift, and the Evoqua claims matter.
   - Regulatory flag: the system cannot replace the manual health-code tests; it complements them.
   - Rest of world: DIN 19643, PWTAG, the French public-health code (ARS inspections), and the WHO guidelines for recreational water.
8. **Recommendation.** Offer a service to pool-service companies: "a chemistry dashboard across your routes plus automatic logs". Do not make hardware for homeowners.

## 4. Grease interceptor fill forecasting (FOG) and pump-out routing

1. **What it is.** A level sensor in the grease interceptor plus ML predicts the day the 25% level will be reached. The pumping company gets optimized routes and the restaurant gets an automatic compliance record.
2. **How to build it.** An ultrasonic or ToF sensor in the riser, sending over LTE-M or LoRa. The model:
   - Clean the echo signal; spurious reflections are a known failure mode.
   - Forecast fill rate from kitchen activity (point-of-sale data, day of week).
   - Plan routes and schedules for the fleet, in the style of arXiv 1807.01603.
3. **Hardware and price.**
   - DFRobot A02YYUW (IP67): $17.88.
   - ESP32 or LoRa node with a battery: about $30–50.
   - Total: about $60–100.
   - Grease and condensation fouling the transducer is the main failure mode; the Water Analytics patent says this itself. Calibrate with a monthly manual stick measurement.
4. **Customers.** Restaurant chains, food courts and central kitchens. Also grease-pumping companies and city FOG programs. In the US the "25% rule" applies: pump quarterly or when grease plus solids reach 25% of depth, whichever comes first, with a record of the percentage. Competitors: Drain-Net GreaseWatch 3 ($300 a year subscription) and GreaseWatch 5 ($5,310), and Rivio.
5. **Where in the world.**
   - Dubai: grease-trap service companies must register on the municipality's "FoodWatch" platform and use it for everything related to grease traps, which gives regulatory pull toward digital records.
   - Singapore (NEA/PUB): cleaning about every 2 weeks, with a record that includes the contractor's license number.
   - Hong Kong: the EPD requires cleaning records.
   - Also UK water utilities (fatbergs) and Australia (trade-waste agreements).
6. **Sources.**
   - Patents US11340096B2 and US11774391B2, Water Analytics Inc (2018): the claims cover a specific capacitive probe with electrode rings, so an ultrasonic sensor plus ML falls outside them. **No PCT; US only.**
   - Patent US8471725B2, Markus Lenger (2007): telemetry with cameras, sonar and level sensors. US only; with the term adjustment it expires around 2031, and I did not check maintenance fees.
   - AU2018360590B2 and ES3021202T3, a non-contact ultrasonic FOG sensor: seen in search results, not opened. This family covers AU and ES/EP, which is a risk outside the US.
   - arXiv 1807.01603, "BIN-CT: Urban Waste Collection based in Predicting the Container Fill Level": fill forecasting plus routing.
   - arXiv 2405.19341, acoustic level sensing with ensemble learning (>90% accuracy).
7. **Maturity and risks.**
   - The ML (a fill forecast) is modest but has clear value.
   - The hardware lives in a hostile environment.
   - Regulatory flag, US: municipal pretreatment ordinances; the pumping record is the legal document, and the sensor does not replace the hauler's measurement.
   - Rest of world: Dubai Local Order 8/2002 plus FoodWatch, Singapore NEA/PUB codes, Hong Kong WPCO.
8. **Recommendation.** Sell to one pumping company as "−20–30% empty trips" (my hypothesis) plus white-label reports for its restaurant customers.

## 5. Chlorine residual forecasting and dosing at small systems and water points (a SWOT-type tool, new global candidate)

1. **What it is.** ML predicts how much free chlorine will be left at the point of consumption after hours of storage, and sets the dosing target at the distribution point. This addresses both under-chlorination and complaints about the taste of chlorine.
2. **How to build it.** Measure free chlorine at the tapstand, plus temperature, EC and storage time, by hand or with sensors. An ensemble of neural networks or quantile regression outputs a probability distribution of chlorine at the household. The system then recommends a dose, and a peristaltic dosing pump can apply it. Models run in the cloud; field readings come in by phone.
3. **Hardware and price.**
   - Full probe set (ORP, pH, EC, temperature, ESP32 with GSM): about $180–200, above the cost target.
   - Cheaper variant: a phone with a strip or DPD reading, plus a temperature logger at about $5.
   - Peristaltic dosing pump: about $30–100 (estimate).
4. **Customers.** In the US, small community systems serving under 3,300 people, for operational monitoring only.
5. **Where in the world.** This is where the demand is:
   - Humanitarian operations run by UNHCR, MSF and IOM (IOM also works in Ukraine).
   - Small piped schemes in Africa.
   - Village schemes under India's Jal Jeevan Mission.
   - Emergency water points in Ukraine.
   - The original tool, SWOT (York University and MSF), is open source, so the competition is "free science" rather than companies.
6. **Sources.**
   - Heylen et al. 2024, Environmental Science & Technology, PMC11500394 (peer-reviewed, not arXiv). In Kyaka II, Uganda, the share of households with free chlorine ≥0.2 mg/L rose from 23% to 35% on the piped system and from 8% to 42% on trucked water. The target at the distribution point rose to 0.7–0.9 mg/L.
   - npj Clean Water 2021, SWOT with an ensemble of neural networks: seen in search results; the page is behind authorization.
   - arXiv 2501.02107: concept drift in chlorine sensors.
   - arXiv 2602.07299, "Optimizing Chlorination in Water Distribution Systems via Surrogate-assisted Neuroevolution".
   - arXiv 2312.01624, "GVFs in the Real World: Making Predictions Online for Water Treatment": online learning beat models trained only on history at a real plant.
   - arXiv 2604.04240, "Peoples Water Data…": screening for E. coli from cheap physicochemical measurements, 2,207 samples, Chennai.
   - Patent US11352266B2 (Evoqua) concerns recirculating systems and does not bear directly on distribution networks. US5675504, on predicting residual chlorine, is old and presumably expired; not opened.
7. **Maturity and risks.** The science has been validated in the field, but customers are grant-funded and procurement is slow. Regulatory flag: this is advisory. Compliance monitoring of a US public water system uses EPA-approved methods and certified labs. Rest of world: the WHO guidelines and Sphere standards (0.2–0.5 mg/L at the point of delivery), India IS 10500 plus JJM protocols, and Ukraine ДСанПіН.
8. **Recommendation.** Implement and support it as a commercial SaaS on top of the open method for NGOs, water utilities, and the JJM program. It pairs well with idea 6 for the input readings.

## 6. Test-strip reading from a photo (smartphone or ESP32-CAM) plus an AI report

1. **What it is.** A phone reads a strip or a colorimetric test and corrects for lighting. An LLM or ML model then writes a report with recommendations and decides when a lab test is needed.
2. **How to build it.** An object detector finds the strip and a reference color card. Color is corrected in RAW/HSV space, and a classifier or regressor reads each pad, following arXiv 1703.10217. An optional light box uses an ESP32-CAM for repeatable readings. The phone runs detection; the cloud keeps history and the report.
3. **Hardware and price.**
   - ESP32-CAM: about $6–15.
   - Light box with LEDs: about $25–40 in total.
   - Strips: about $0.2–1 each (estimate).
   - Strips age with humidity and light, and different batches differ, so each batch needs a reference card.
4. **Customers.**
   - US water-treatment dealers (Culligan, Kinetico, RainSoft), who already sell through an in-home water test.
   - Private well owners and home inspectors. New Jersey requires a well test when a property is sold.
   - For comparison, Tap Score Essential costs about $140–209.
5. **Where in the world.**
   - India: Jal Jeevan Mission trains 5 women per village to use field test kits and upload results.
   - Humanitarian and development projects.
   - The main non-US competitor is **Akvo Caddisfly** (Netherlands; open source, 29 parameters, strips read by phone camera). Others: LaMotte and AquaChek apps, and Leslie's AccuBlue.
6. **Sources.**
   - arXiv 1703.10217, "Smartphone Based Colorimetric Detection via Machine Learning": LS-SVM, pH strips, robust to lighting.
   - arXiv 2603.06611, "A Novel Approach for Testing Water Safety Using Deep Learning Inference of Microscopic Images of Unincubated Water Samples": 93% accuracy, 100,000 field images from Washington state.
   - arXiv 2201.03348, "PlomBOX": lead detection with a biosensor plus ESP32-CAM, targeting about £10.
   - Patent US11423637B2, Digital Concepts of Missouri (2015). Claim: a strip with a two-dimensional code that a phone reads with object detection. **US only** (a divisional of US9990560).
   - Patent US9569858B2, Babcock et al. (2014): a cloud system for several types of strip readers. US.
   - WO2014113770A1 and EP2946198B1, smartphone colorimetry: seen in search results; the EP grant means **there is an EP family**.
7. **Maturity and risks.**
   - The technology is solved and the competition is free apps, so the value is in the report and the funnel, not in reading colors.
   - Strips give indicative results only.
   - Regulatory flag, US: a "safe to drink" verdict needs a certified lab; the product only screens and triages.
   - Rest of world: WHO guidelines, JJM (field test kits are indicative, with confirmation in an NABL-accredited lab), EU (accredited labs under ISO 17025).
8. **Recommendation.** For the US, use it as lead generation for dealers: "a photo of the strip, then a report, then an appointment or a lab test". In India and the humanitarian sector, use it as a tool for data quality in field testing.

## 7. Lead service line triage: customer photos plus a model for the inventory (niche: US, Canada, UK and Ireland)

1. **What it is.** Classify customer photos of the service line (lead, galvanized, copper, plastic, using scratch and magnet tests), combined with a model like BlueConduit's, to shrink the "unknown" category in the inventory.
2. **How to build it.** A vision classifier plus a tabular model on property age and the utility's records. Active learning chooses which properties to excavate, as in arXiv 1806.10692.
3. **Hardware and price.** A phone, a magnet and a coin, so about $0.
4. **Customers.** Small and mid-sized US utilities. The deadline to watch is **November 1, 2027** (baseline inventory and replacement plan under the Lead and Copper Rule Improvements), with the 10-year replacement mandate running to about 2037. The rule is being challenged in court. Competitors: BlueConduit, 120Water (they are partners), Trinnex.
5. **Where in the world.** Canada (Montreal, Toronto) and UK/Ireland. The EU tightens the lead limit from 10 to 5 µg/L by 2036. Outside English-speaking countries, pull is weak.
6. **Sources.**
   - arXiv 1806.10692, "ActiveRemediation: The Search for Lead Pipes in Flint, Michigan".
   - arXiv 2608.19922: an audit of predictive service-line classifications in New York. New York City's model cleared 43,215 addresses as "not lead", and the paper estimates 1,150–1,450 lead lines among model-cleared addresses elsewhere in the state. This is a strong argument for physical verification plus photos.
   - arXiv 2201.09372 (lead replacement prioritization as a knapsack problem) and arXiv 1610.00580 (Flint risk assessment).
   - Patent US12487209B2, Solinas Technologies (Canada, 2024): identifying pipe material by acoustic waves. This is a different method.
7. **Maturity and risks.** Hardware is not the point here, and it is a government sale with procurement. Regulatory flag: the US rule's accepted inventory methods are set by the EPA and the states.
8. **Recommendation.** Only as a subcontractor to engineering firms. It is weaker than ideas 1–6.

**Rejected:**
- Wells and boreholes with cheap probes: they cannot see bacteria, nitrate or arsenic. An arsenic risk model already exists (arXiv 2607.19392: graph neural networks on 74,000 US well samples), so this is a data product, not a gadget.
- Water softener salt level: little ML, and A. O. Smith has US20220194819A1 on regeneration control.
- PFAS: cheap sensors cannot measure it.
- Atmospheric water generators: arXiv has almost only physics.

---

## Ranking

1. **Legionella thermal twin:** the only idea where the cheap sensor (temperature) does not drift. The ML is useful (inferring flushes, scoring risk), and it has recurring compliance pull in the UK, Germany, the EU and US CMS/ASHRAE 188. The FTO risk is mainly the Intellihot patent, and only in the US.
2. **RO refill station and water ATM copilot:** tens of thousands of small operators worldwide (Indonesia alone has more than 20,000), sturdy sensors, a clear return (fewer trips, longer membrane life, compliance log), and a channel through equipment makers.
3. Next are FOG forecasting (quick to build; Dubai's FoodWatch and the US 25% rule) and chlorine residual forecasting (strong science, but slow grant-funded customers).

Sources: [USPTO 11815272](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/11815272) · [Whiley 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6518245/) · [HSG274](https://aquaiot.co.uk/legionella-monitoring-frequency/) · [TrinkwV](https://www.bundesgesundheitsministerium.de/service/begriffe-von-a-z/t/trinkwasser/trinkwasserverordnung-und-legionellen) · [EU Directive 2020/2184](https://eur-lex.europa.eu/legal-content/en/TXT/?uri=CELEX%3A32020L2184) · [CMS QSO-17-30](https://cmscompliancegroup.com/blog/qso-memo-legionella/) · [CA 17 CCR 7865](https://www.law.cornell.edu/regulations/california/17-CCR-7865) · [DAMIU Indonesia](https://www.nawasis.org/portal/galeri/read/fakta-depot-air-minum-isi-ulang-damiu-di-indonesia/52309) · [Mykolaiv Dez Pilot](https://utility-platform.com/partnerschaft/enercity-ag-mykolayivvodokanal-dez-pilot-mykolaivoblteploenergo/) · [DrinkPrime](https://drinkprime.in/) · [NGT/SC stay](https://www.business-standard.com/article/current-affairs/sc-stays-ngt-ban-on-water-purifiers-where-tds-below-500-mg-per-litre-122030100625_1.html) · [pHin shutdown](https://iopool.com/blogs/connected-objects/phin-alternative) · [Fluidra–Riiot](https://www.fluidra.com/press-releases/fluidra-acquires-the-belgium-start-up-riiot-labs-to-launch-pool-monitoring-from-mobile-devices) · [CDC pool inspections](https://archive.cdc.gov/www_cdc_gov/media/releases/2016/p0519-public-pools.html) · [Drain-Net](https://www.drain-tech.com/grease-traps/grease-trap-monitoring/greasewatch-3-grease-trap-monitoring-through-cellular-connection/) · [Dubai grease traps](https://greasetrapcleaningdubai.com/dubai-municipality-grease-trap-regulations.html) · [Singapore grease traps](https://www.pub.gov.sg/Professionals/Requirements/Used-Water/Grease-Trap) · [SWOT Uganda](https://pmc.ncbi.nlm.nih.gov/articles/PMC11500394/) · [Akvo Caddisfly](https://akvopedia.org/wiki/Akvo_Caddisfly) · [Lead rule status](https://ebhengineering.com/2026/01/20/lead-service-lines/) · [EPA PFAS](https://www.federalregister.gov/documents/2026/05/20/2026-10086/extending-the-compliance-deadline-for-the-pfoa-and-pfos-maximum-contaminant-levels) · [DFRobot TDS](https://www.dfrobot.com/product-1662.html) · [A02YYUW](https://www.digikey.com/en/products/detail/dfrobot/SEN0313/11202720) · [LHT65](https://www.cnx-software.com/2019/10/16/lorawan-temperature-humidity-sensor-dragino-lht65/) · [Orbis EP](https://patents.google.com/patent/EP3980728C0/de)

Patent PDFs and OCR text are in `/private/tmp/claude-501/-Users-andriizhyla-Library-CloudStorage-GoogleDrive-andywar777-gmail-com-My-Drive--------Private/3be0c21c-ba56-457c-9284-ce0faa2697b8/scratchpad/` (p*.pdf, p*.txt), and the raw arXiv results are in `ax_out*.txt` in the same folder.