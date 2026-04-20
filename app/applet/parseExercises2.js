const fs = require('fs');

const text = `
Gambe e Glutei
Back Squat (High bar)
Back Squat (Low bar)
Front Squat
Stacco da terra (Deadlift convenzionale)
Stacco Sumo
Stacco Rumeno (RDL)
Stacco a gambe tese (SDL)
Stacco dai rialzi (Deficit Deadlift)
Pin Pull (Stacco parziale dal rack)
Good Morning
Hip Thrust
Affondi con bilanciere
Bulgarian Split Squat con bilanciere
Zercher Squat (bilanciere incastrato nei gomiti)
Overhead Squat
Hack Squat con bilanciere (dietro la schiena)
Jefferson Squat (bilanciere tra le gambe)
Box Squat
Calf Raise con bilanciere (in piedi)

Spinta (Petto e Spalle)
Panca Piana
Panca Inclinata
Panca Declinata
Panca presa stretta (Close grip)
Floor Press (Panca a terra)
Military Press (in piedi)
Shoulder Press (da seduto)
Z-Press (spinta seduto a terra senza schienale)
Push Press (spinta con aiuto delle gambe)
Tirate al mento (Upright Row)
Board Press (panca con tavoletta sul petto)
Guillotine Press (panca al collo)

Trazione e Braccia
Rematore con bilanciere (Bust-over Row)
Pendlay Row (rematore esplosivo da terra)
Rematore a T (T-Bar Row)
Yates Row (presa supina, busto più dritto)
Scrollate (Shrugs)
Curl con bilanciere dritto
Curl con bilanciere EZ
Spider Curl (busto appoggiato su panca)
French Press (Skull Crushers)
JM Press (ibrido panca/french press)

Parte Superiore
Spinte piana/inclinata/declinata
Croci su panca (varie inclinazioni)
Svend Press con manubrio
Arnold Press
Shoulder Press (manubri paralleli o proni)
Alzate laterali
Alzate frontali
Alzate a 90° (per deltoidi posteriori)
L-Fly (rotatori della spalla)
Rematore singolo su panca
Rematore simultaneo (Seal Row con manubri)
Scrollate con manubri
Curl alternato
Curl a martello (Hammer)
Curl su panca inclinata
Curl concentrato
Zottman Curl (rotazione del polso)
Tate Press (tricipiti)
Kickback (tricipiti)
Estensioni dietro nuca (singole o doppie)

Parte Inferiore
Goblet Squat
Affondi camminati
Affondi laterali
Stacco rumeno con manubri
Step-up su box
Bulgarian Split Squat (con due manubri)
Pistol Squat assistito con manubrio
Calf Raise singolo con manubrio

Chest Press (orizzontale/inclinata)
Pec Deck (Butterfly)
Chest Press convergente
Shoulder Press Machine
Lateral Raise Machine (alzate laterali assistite)
Dip Machine (tricipiti e petto)

Lat Machine (avanti/dietro/presa stretta)
Pulley basso (Seated Row)
Vertical Row (presa neutra/prona)
Pullover Machine
Assisted Pull-up Machine (trazioni assistite)
Reverse Pec Deck (deltoidi posteriori)
Ipereatensioni alla panca 45°

Leg Press 45°
Leg Press Orizzontale
Hack Squat Machine
Pendulum Squat
Belt Squat Machine
Leg Extension
Leg Curl (sdraiato/seduto/in piedi)
Adductor Machine
Abductor Machine
Glute Drive (Hip Thrust machine)
Calf Press sulla leg press
Seated Calf Raise (polpacci seduti)
Standing Calf Raise Machine

Cross-over ai cavi alti
Cross-over ai cavi bassi
Spinte in avanti ai cavi (Chest press ai cavi)
Face Pull
Pull-down a braccia tese
Rematore al cavo singolo (monolaterale)
Alzate laterali al cavo (dietro schiena o davanti)
Alzate frontali alla corda
Curl al cavo basso (barra o fune)
Hercules Curl (ai cavi alti)
Pushdown tricipiti (fune/barra dritta/barra a V)
Estensioni sopra la testa al cavo
Kickback al cavo
Glute Kickback al cavo
Slanci laterali per glutei (Abduzioni al cavo)
Pull-through (per glutei e femorali)
Crunch al cavo alto (da inginocchiati)
Woodchopper (rotazioni core)

Piegamenti sulle braccia (Push-ups)
Diamond Push-ups
Archer Push-ups
Dips alle parallele
Trazioni alla sbarra (Pull-ups)
Chin-ups (supine)
Neutral Grip Pull-ups
Australian Pull-ups (Rematore inverso)
Muscle-up
Pike Push-ups (spalle)
Verticale al muro (Handstand hold)
Piegamenti in verticale (HSPU)
Plank (frontale/laterale)
Hollow Body Hold
Crunch (tutte le varianti)
Leg Raise appesi
L-Sit (alle parallele o a terra)
Burpees
Mountain Climbers
Squat a corpo libero
Pistol Squat
Affondi saltati

Smith Machine (Multipower)
Squat alla Smith
Affondi bulgari alla Smith
Panca piana alla Smith
Shoulder press alla Smith
Drag Curl alla Smith

Swing
Snatch
Clean
Turkish Get-up
Windmill
Bottom-up Press

Landmine Press (singolo o doppio)
Landmine Row (Rematore Meadow)
Landmine Twist (core)
Landmine Squat

Palla Medica Slams
Wall Ball
Battle Ropes (onde, cerchi, colpi)
Sled Push (spinta slitta)
Sled Pull (tiro slitta)
Box Jumps
Farmer's Walk (camminata con carichi pesanti)
Ab Wheel Rollout
TRX Row / TRX Push-up
GHD Sit-ups (su panca GHD)
Back Extension su GHD

Rematore presa inversa
Panca piana presa inversa (ottima per le spalle)
Curl a presa prona (Brachiale)
Stacco con Trap Bar
Shoulder Press con presa neutra (Log press style)
Spinte manubri a terra
Dips tra due panche (con sovraccarico)
Z-Curl
Reverse Fly su panca inclinata
Sissy Squat (manuale o alla macchina)
Cossack Squat con peso
Frog Pump (per glutei)
Stacco Rumeno monolaterale
Affondi posteriori
Crunch bicicletta
Russian Twist con disco
Plank con tocco spalle
V-Ups
Flutter Kicks
Heel Touches
Bird-Dog (core e stabilità)
Superman (lombari)
Ponte per i glutei (Glute Bridge)
Calf Raise seduto a corpo libero (pressione manuale)
Trazioni alla sbarra con sovraccarico
Piegamenti su manubri (per maggior profondità)
Spinte a 45 gradi per petto alto
Rematore "Gorilla" con kettlebell
Walking Plank
Bear Crawl (camminata dell'orso)
Dead Bug
Pallof Press (anti-rotazione al cavo)
Jump Squat con manubri
Thruster (Squat + Spinta sopra la testa)
Man Maker (Pushup + Row + Squat + Press)
Kettlebell Halo
Spinte con bilanciere svizzero (Swiss Bar - se presente)
Tirate al petto con corda (High Row)
Trazioni presa stretta a V
`;

let lines = text.split('\n').map(l => l.trim()).filter(l => l);
let currentCategory = 'Petto';
let output = [];

let idCounter = 100;

function guessCategory(line) {
    line = line.toLowerCase();
    if (line.includes('squat') || line.includes('stacco') || line.includes('affond') || line.includes('leg') || line.includes('glute') || line.includes('calf') || line.includes('hip') || line.includes('step')) return 'Gambe';
    if (line.includes('panca') || line.includes('press') || line.includes('croci') || line.includes('push') || line.includes('chest') || line.includes('pec deck') || line.includes('dip')) return 'Petto';
    if (line.includes('rematore') || line.includes('pull') || line.includes('chin') || line.includes('lat ') || line.includes('row') || line.includes('scrollate')) return 'Schiena';
    if (line.includes('alzate') || line.includes('spalle') || line.includes('shoulder') || line.includes('fly')) return 'Spalle';
    if (line.includes('curl') || line.includes('trazione')) return 'Bicipiti';
    if (line.includes('french') || line.includes('tricipit') || line.includes('kickback') || line.includes('pushdown') || line.includes('estension') || line.includes('jm press')) return 'Tricipiti';
    if (line.includes('crunch') || line.includes('plank') || line.includes('twist') || line.includes('sit-up') || line.includes('core') || line.includes('ab ') || line.includes('bug')) return 'Core';
    return currentCategory;
}

lines.forEach(line => {
    if (line.match(/^[A-Z0-9.\s'()]+$/) && line.length < 30 && !line.includes('Squat') && !line.includes('Press') && !line.includes('Curl') && !line.includes('Row') && !line.includes('Pull') && !line.includes('Push')) {
        // let's just ignore categories from text and dynamically guess
    } else {
        if(line.startsWith('I manubri') || line.startsWith('Ideali per') || line.startsWith('Tensione costante') || line.startsWith('Il tuo peso') || line.startsWith('Cose che trovi') || line.startsWith('Per arrivare a')) return;
        
        // Remove text in parenthesis from name for guessing ? It's fine.
        let cat = guessCategory(line);
        if (cat === 'Altro') cat = 'Petto';
        
        let equipment = 'Multifunzione';
        if (line.toLowerCase().includes('manubri') || line.toLowerCase().includes('dumbell')) equipment = 'Manubri';
        if (line.toLowerCase().includes('bilanciere')) equipment = 'Bilanciere';
        if (line.toLowerCase().includes('cavi') || line.toLowerCase().includes('cavo')) equipment = 'Cavi';
        if (line.toLowerCase().includes('machine')) equipment = 'Macchinario';
        if (line.toLowerCase().includes('corpo libero')) equipment = 'Corpo Libero';
        
        output.push(\`  { id: 'ne\${idCounter++}', name: '\${line.replace(/'/g, "\\'")}', category: '\${cat}', targetMuscles: ['\${cat}'], equipment: '\${equipment}', type: 'Composto', proNote: 'Esercizio fondamentale per la categoria.', instructions: '1. Assumi la posizione corretta.\\n2. Esegui il movimento in modo controllato.\\n3. Contrai il muscolo target e respira correttamente.\\n4. Torna alla posizione di partenza con controllo.', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ' }\`);
    }
});

fs.writeFileSync('new_exercises.ts', output.join(',\\n'));

