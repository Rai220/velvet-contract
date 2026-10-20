/* ==========================================================================
   VELVET CONTRACT — static game data
   ========================================================================== */
(function () {
  'use strict';
  const VC = (window.VC = window.VC || {});

  // Clearance tags are also room zones.
  const OUTFITS = {
    guest: {
      id: 'guest', label: 'Guest', short: 'GUEST', color: '#b79a62', trim: '#ead99e',
      clearance: ['public', 'private'], social: true,
      desc: 'Invited. Unremarkable. Welcome in the public rooms and private suites.'
    },
    staff: {
      id: 'staff', label: 'House Staff', short: 'STAFF', color: '#45626b', trim: '#b8d0d2',
      clearance: ['public', 'private', 'staff', 'service'], social: false,
      desc: 'Service corridors, kitchens and guest rooms. Invisible by design.'
    },
    chef: {
      id: 'chef', label: 'Kitchen Chef', short: 'CHEF', color: '#e1ddcf', trim: '#b7c5c6',
      clearance: ['public', 'staff'], social: false,
      desc: 'Master of the kitchen and service areas. Never questioned near food.'
    },
    guard: {
      id: 'guard', label: 'Security', short: 'SECURITY', color: '#252d38', trim: '#8793a3',
      clearance: ['public', 'private', 'staff', 'security', 'service'], social: false,
      desc: 'Full access. Other guards assume you belong. Guests do not.'
    },
    tech: {
      id: 'tech', label: 'Technician', short: 'TECH', color: '#a55f32', trim: '#e1b261',
      clearance: ['public', 'staff', 'service'], social: false,
      desc: 'Engine rooms, garages and service tunnels. Perfect for sabotage.'
    },
    vip: {
      id: 'vip', label: 'VIP', short: 'VIP', color: '#71364f', trim: '#d7a6bb',
      clearance: ['public', 'private'], social: true,
      desc: 'The room notices you. The room also forgives you.'
    }
  };

  const ZONES = {
    public: { label: 'PUBLIC', color: '#b8a680' },
    private: { label: 'PRIVATE', color: '#a58abd' },
    staff: { label: 'STAFF ONLY', color: '#759eb4' },
    service: { label: 'SERVICE', color: '#c08b56' },
    security: { label: 'SECURITY', color: '#c75a53' }
  };

  const ROOM_TYPES = {
    lobby: { zone: 'public', floor: 'marble', layout: 'lobby', targetable: false, social: true },
    lounge: { zone: 'public', floor: 'carpet', layout: 'lounge', targetable: true, social: true },
    ballroom: { zone: 'public', floor: 'marble', layout: 'ballroom', targetable: true, social: true },
    dining: { zone: 'public', floor: 'wood', layout: 'dining', targetable: true, social: true },
    bar: { zone: 'public', floor: 'wood', layout: 'bar', targetable: true, social: true },
    kitchen: { zone: 'staff', floor: 'tile', layout: 'kitchen', targetable: false, social: false },
    pantry: { zone: 'staff', floor: 'tile', layout: 'pantry', targetable: false, social: false },
    storage: { zone: 'staff', floor: 'concrete', layout: 'storage', targetable: false, social: false },
    laundry: { zone: 'staff', floor: 'tile', layout: 'laundry', targetable: false, social: false },
    security: { zone: 'security', floor: 'metal', layout: 'security', targetable: false, social: false },
    office: { zone: 'private', floor: 'wood', layout: 'office', targetable: true, social: false },
    suite: { zone: 'private', floor: 'carpet', layout: 'bedroom', targetable: true, social: false },
    bedroom: { zone: 'private', floor: 'carpet', layout: 'bedroom', targetable: true, social: false },
    garage: { zone: 'service', floor: 'concrete', layout: 'garage', targetable: false, social: false },
    cargo: { zone: 'service', floor: 'metal', layout: 'cargo', targetable: false, social: false },
    engine: { zone: 'service', floor: 'metal', layout: 'engine', targetable: false, social: false },
    bridge: { zone: 'security', floor: 'metal', layout: 'bridge', targetable: false, social: false },
    cockpit: { zone: 'security', floor: 'metal', layout: 'bridge', targetable: false, social: false },
    bathroom: { zone: 'public', floor: 'tile', layout: 'bathroom', targetable: false, social: false },
    infirmary: { zone: 'staff', floor: 'tile', layout: 'infirmary', targetable: false, social: false },
    garden: { zone: 'public', floor: 'stone', layout: 'garden', targetable: true, social: true },
    pool: { zone: 'public', floor: 'stone', layout: 'pool', targetable: true, social: true },
    spa: { zone: 'public', floor: 'stone', layout: 'spa', targetable: true, social: true },
    conference: { zone: 'private', floor: 'carpet', layout: 'conference', targetable: true, social: false },
    winecellar: { zone: 'staff', floor: 'stone', layout: 'winecellar', targetable: false, social: false },
    crew: { zone: 'staff', floor: 'carpet', layout: 'crew', targetable: false, social: false }
  };

  const THEMES = {
    embassy: {
      id: 'embassy',
      name: 'Meridian Embassy',
      short: 'EMBASSY',
      city: 'Prague · Midnight',
      size: { w: 84, h: 40 },
      flavor: 'A diplomatic reception is winding down beneath the chandeliers. The ambassador\'s private wing is one long, polished lie.',
      tip: 'Reception staff uniforms are kept in the laundry. Security is tighter near the private wing.',
      palette: {
        ambient: '#ffd08a', accent: '#d7b66a', wall: '#2c2924', wallTop: '#514b40', trim: '#8e7d5d',
        corridor: '#4a4439', corridorAlt: '#413b32', outside: '#141820', outsideAlt: '#1e252d',
        marble: '#77736a', marbleAlt: '#89857b', marbleVein: '#5e5b54',
        wood: '#62472f', woodAlt: '#533b27', carpet: '#483f3a', carpetAlt: '#3d3531',
        tile: '#65645c', tileAlt: '#595850', concrete: '#55554e', metal: '#3e464b', stone: '#5c574c'
      },
      rooms: {
        lobby: ['Grand Lobby', 'Reception Rotunda'],
        lounge: ['Gold Lounge', 'Reception Salon', 'Map Room'],
        ballroom: ['State Ballroom', 'Diplomatic Hall'],
        dining: ['Dining Hall', 'Banquet Room'],
        bar: ['The Oak Bar', 'Consular Bar'],
        kitchen: ['Embassy Kitchen', 'Banquet Kitchen'],
        pantry: ['Service Pantry', 'Silver Pantry'],
        storage: ['Records Storage', 'Laundry'],
        laundry: ['Staff Laundry', 'Linen Room'],
        security: ['Security Office', 'Guard Room'],
        office: ['Ambassador\'s Study', 'Trade Office', 'Cipher Room'],
        suite: ['Ambassador\'s Suite', 'Residential Suite'],
        bedroom: ['Guest Suite', 'Diplomatic Quarters'],
        garage: ['Motor Pool', 'Embassy Garage'],
        bathroom: ['Marble Restroom', 'Powder Room'],
        garden: ['Palm Courtyard', 'Winter Garden'],
        winecellar: ['Wine Cellar', 'Consular Cellar'],
        conference: ['Conference Room', 'Treaty Room']
      },
      targetTitles: ['Ambassador', 'Consul General', 'Trade Envoy'],
      targetNames: ['Viktor Soren', 'Elena Vasquez', 'Marcus Vale', 'Irina Bellamy', 'Dorian Kade'],
      stars: '✦'
    },
    ship: {
      id: 'ship',
      name: 'SS Aurelia',
      short: 'CRUISE SHIP',
      city: 'The Adriatic · 02:14',
      size: { w: 86, h: 40 },
      flavor: 'A floating palace drifts between sleeping ports. Below the ballroom, the engine room hums like a held breath.',
      tip: 'The crew respects a uniform. The engine room is restricted to technicians and security.',
      palette: {
        ambient: '#ffcf8a', accent: '#d0ae69', wall: '#243035', wallTop: '#465b60', trim: '#7d9ba0',
        corridor: '#4a453c', corridorAlt: '#3f3a32', outside: '#081a25', outsideAlt: '#0d2a3a',
        marble: '#66716f', marbleAlt: '#78817e', marbleVein: '#515a58',
        wood: '#5c432b', woodAlt: '#4b3522', carpet: '#314649', carpetAlt: '#293c3f',
        tile: '#5b6664', tileAlt: '#505b59', concrete: '#4f5552', metal: '#38454b', stone: '#535d59'
      },
      rooms: {
        lobby: ['Grand Atrium', 'Purser\'s Foyer'],
        lounge: ['Azure Lounge', 'Promenade Salon', 'Winter Garden Lounge'],
        ballroom: ['Marquee Ballroom', 'Neptune Hall'],
        dining: ['Grand Dining Room', 'Veranda Restaurant'],
        bar: ['Sunset Bar', 'Piano Bar'],
        kitchen: ['Ship\'s Galley', 'Provision Kitchen'],
        pantry: ['Dry Stores', 'Beverage Pantry'],
        storage: ['Crew Storage', 'Deck Locker'],
        laundry: ['Crew Laundry', 'Linen Store'],
        security: ['Bridge Security', 'Master-at-Arms Office'],
        office: ['Captain\'s Office', 'Cruise Director\'s Office'],
        suite: ['Owner\'s Suite', 'Admiral Suite'],
        bedroom: ['Guest Cabin', 'Captain\'s Cabin'],
        cargo: ['Cargo Hold', 'Baggage Hold'],
        engine: ['Engine Room', 'Auxiliary Engine Room'],
        bridge: ['The Bridge', 'Navigation Room'],
        bathroom: ['Marble Bath', 'Spa Restroom'],
        infirmary: ['Ship\'s Infirmary', 'Medical Bay'],
        pool: ['Lido Deck', 'Sun Deck']
      },
      targetTitles: ['Shipowner', 'Captain', 'Cruise Magnate'],
      targetNames: ['Adrian Voss', 'Celeste Marlow', 'Nikos Radev', 'Mara Bellini', 'Hugo Laurent'],
      stars: '⚓'
    },
    plane: {
      id: 'plane',
      name: 'Azure 890',
      short: 'PRIVATE JET',
      city: '36,000 ft · Night',
      size: { w: 98, h: 30 },
      flavor: 'A private jet above the clouds, all cream leather and cold champagne. There is nowhere to run at altitude.',
      tip: 'The galley is staff-only. The cockpit is sealed to everyone but security. Bring the right clothes.',
      palette: {
        ambient: '#ffd49c', accent: '#cbb075', wall: '#252b35', wallTop: '#4a5565', trim: '#7d8ea6',
        corridor: '#4b3b3b', corridorAlt: '#423333', outside: '#0c1930', outsideAlt: '#132844',
        marble: '#6e6f6c', marbleAlt: '#7f807b', marbleVein: '#595a57',
        wood: '#523a2a', woodAlt: '#443021', carpet: '#3f3a46', carpetAlt: '#38333e',
        tile: '#5e625e', tileAlt: '#535752', concrete: '#4d5351', metal: '#36434c', stone: '#545b5a'
      },
      rooms: {
        lobby: ['Forward Cabin', 'Entry Vestibule'],
        lounge: ['First Class Lounge', 'Salon Cabin', 'Sky Lounge'],
        dining: ['Dining Salon', 'Private Dining'],
        bar: ['Sky Bar', 'Champagne Bar'],
        kitchen: ['Aircraft Galley', 'Service Galley'],
        pantry: ['Crew Pantry', 'Wet Stores'],
        storage: ['Crew Storage', 'Aft Locker'],
        security: ['Cockpit', 'Flight Security'],
        office: ['Communications Bay', 'Flight Office'],
        suite: ['Owner\'s Suite', 'Presidential Cabin'],
        bedroom: ['Private Bedroom', 'Sleeper Cabin'],
        cargo: ['Cargo Bay', 'Baggage Compartment'],
        bathroom: ['Lavatory', 'Private Washroom'],
        conference: ['Conference Cabin', 'Situation Room'],
        infirmary: ['Medical Bay', 'Flight Clinic'],
        cockpit: ['Cockpit', 'Flight Deck']
      },
      targetTitles: ['Industrialist', 'Sovereign Investor', 'Media Baron'],
      targetNames: ['Roman Saito', 'Aurelia Kane', 'Felix Dorn', 'Yara Voss', 'Julian Crane'],
      stars: '✈'
    },
    villa: {
      id: 'villa',
      name: 'Casa del Lago',
      short: 'LAKESIDE VILLA',
      city: 'Lake Como · Dusk',
      size: { w: 78, h: 38 },
      flavor: 'A glass-and-stone villa above the water. The owner is hosting a private supper, and the garage is full of cars that cost more than the staff.',
      tip: 'The garage and wine cellar are service areas. A technician\'s coveralls open the worst doors.',
      palette: {
        ambient: '#ffc07a', accent: '#d3a45f', wall: '#362c27', wallTop: '#604c40', trim: '#9b7757',
        corridor: '#68513e', corridorAlt: '#5b4635', outside: '#13201c', outsideAlt: '#20342b',
        marble: '#7d7062', marbleAlt: '#8e8170', marbleVein: '#665b50',
        wood: '#6f4c30', woodAlt: '#5c3d25', carpet: '#513c38', carpetAlt: '#45332f',
        tile: '#786d60', tileAlt: '#6b6054', concrete: '#625e54', metal: '#4a4a44', stone: '#746a58'
      },
      rooms: {
        lobby: ['Foyer', 'Entrance Hall'],
        lounge: ['Living Room', 'Great Room', 'Terrace Lounge'],
        dining: ['Dining Room', 'Loggia Dining'],
        bar: ['Poolside Bar', 'Cellar Bar'],
        kitchen: ['Villa Kitchen', 'Chef\'s Kitchen'],
        pantry: ['Pantry', 'Cold Room'],
        storage: ['Utility Room', 'Pool Storage'],
        laundry: ['Laundry', 'Staff Quarters'],
        security: ['Guard Room', 'Security Office'],
        office: ['Study', 'Owner\'s Office'],
        suite: ['Master Bedroom', 'Lake Suite'],
        bedroom: ['Guest Bedroom', 'Garden Bedroom'],
        garage: ['Garage', 'Motor Court'],
        bathroom: ['Guest Bath', 'Marble Bath'],
        garden: ['Courtyard Garden', 'Olive Garden'],
        pool: ['Infinity Pool', 'Pool Terrace'],
        winecellar: ['Wine Cellar', 'Tasting Cellar'],
        conference: ['Meeting Room', 'Library']
      },
      targetTitles: ['Financier', 'Villa Owner', 'Art Collector'],
      targetNames: ['Luca Moretti', 'Vivienne Roux', 'Dante Ferraro', 'Sofia Alcázar', 'Emiliano Costa'],
      stars: '❖'
    },
    hotel: {
      id: 'hotel',
      name: 'Hotel Nocturne',
      short: 'GRAND HOTEL',
      city: 'Paris · 01:37',
      size: { w: 82, h: 42 },
      flavor: 'An art deco hotel where the night manager knows every face worth knowing. The penthouse has its own elevator, its own guards, and its own secrets.',
      tip: 'Housekeeping uniforms open service doors. The penthouse is private. Security patrols the upper corridor.',
      palette: {
        ambient: '#f5c987', accent: '#d0aa67', wall: '#2a2730', wallTop: '#514a5a', trim: '#8c7895',
        corridor: '#4e3e4e', corridorAlt: '#443643', outside: '#131019', outsideAlt: '#211b2a',
        marble: '#706b74', marbleAlt: '#807a84', marbleVein: '#5a555f',
        wood: '#5c3f32', woodAlt: '#4c3328', carpet: '#443243', carpetAlt: '#392a39',
        tile: '#68626a', tileAlt: '#5c565e', concrete: '#555259', metal: '#44414d', stone: '#625d63'
      },
      rooms: {
        lobby: ['Grand Lobby', 'Art Deco Lobby'],
        lounge: ['Jazz Lounge', 'Reading Lounge', 'Mezzanine Lounge'],
        ballroom: ['Nocturne Ballroom', 'Mirror Hall'],
        dining: ['Le Rêve Restaurant', 'Brasserie Nocturne'],
        bar: ['Noir Bar', 'Absinthe Bar'],
        kitchen: ['Hotel Kitchen', 'Pastry Kitchen'],
        pantry: ['Service Pantry', 'Housekeeping Pantry'],
        storage: ['Housekeeping', 'Linen Store'],
        laundry: ['Hotel Laundry', 'Staff Laundry'],
        security: ['Security Office', 'Surveillance Room'],
        office: ['Manager\'s Office', 'Front Office'],
        suite: ['Penthouse Suite', 'Presidential Suite'],
        bedroom: ['Grand Room', 'Corner Room'],
        bathroom: ['Spa Bath', 'Marble Bathroom'],
        spa: ['The Spa', 'Steam Room'],
        conference: ['Conference Room', 'Salon Privé'],
        garden: ['Roof Garden', 'Winter Garden'],
        winecellar: ['Hotel Cellar', 'Champagne Cellar']
      },
      targetTitles: ['Hotel Magnate', 'Night Manager', 'Philanthropist'],
      targetNames: ['Étienne Ravel', 'Margot Duvall', 'Silas Grey', 'Anouk Mercier', 'Pascal Renard'],
      stars: '✧'
    }
  };

  const NPC_NAMES = {
    first: ['Ada', 'Boris', 'Clara', 'Dmitri', 'Esther', 'Felix', 'Greta', 'Hugo', 'Ines', 'Jonas', 'Klara', 'Leon', 'Mira', 'Nils', 'Olga', 'Pavel', 'Rosa', 'Stefan', 'Tessa', 'Ugo', 'Vera', 'Willem', 'Yara', 'Zeno'],
    last: ['Adler', 'Bauer', 'Costa', 'Dorn', 'Engel', 'Falk', 'Graf', 'Hansen', 'Ivanov', 'Jansen', 'Keller', 'Lund', 'Marek', 'Novak', 'Ortega', 'Pfeiffer', 'Quist', 'Roth', 'Stahl', 'Toma', 'Ussher', 'Valdez', 'Weiss', 'Ziegler']
  };

  const POISON_NAMES = ['cyanide tincture', 'undetectable alkaloid', 'bitter almond vial'];
  const TRAP_DEFS = {
    chandelier: { label: 'Loose chandelier', action: 'Loosen chandelier', verb: 'The chandelier came down.', color: '#e1bb6c' },
    electrical: { label: 'Faulty wiring', action: 'Rig wiring', verb: 'The wiring found its mark.', color: '#89c8de' },
    crate: { label: 'Precarious crate stack', action: 'Unbalance crates', verb: 'The crates gave way.', color: '#c08b56' },
    gas: { label: 'Gas line', action: 'Open gas line', verb: 'The gas line ignited.', color: '#e28259' },
    steam: { label: 'Steam valve', action: 'Overpressure valve', verb: 'The steam valve blew.', color: '#b6d2d9' }
  };

  VC.OUTFITS = OUTFITS;
  VC.ZONES = ZONES;
  VC.ROOM_TYPES = ROOM_TYPES;
  VC.THEMES = THEMES;
  VC.NPC_NAMES = NPC_NAMES;
  VC.POISON_NAMES = POISON_NAMES;
  VC.TRAP_DEFS = TRAP_DEFS;
  VC.THEME_IDS = Object.keys(THEMES);
})();
