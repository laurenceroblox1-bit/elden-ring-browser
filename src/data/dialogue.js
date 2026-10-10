// Dialogue scripts. Each speaker is a function of the game state that returns the lines to show
// and an optional effect to run when the conversation ends.
export const DIALOGUE = {
  brannoc(g) {
    const q = g.quests;
    const name = 'Brannoc';
    if (q.status('steed') === 'inactive') {
      return {
        name,
        lines: [
          'Another one walking north. They all walk north.',
          'I kept horses, once. Now I keep one, and she\'s been dead longer than you\'ve been alive. Wisp, I called her. Her spirit still runs, if you call her right.',
          'Hollows from the old watchtower took my bone whistle. Their captain wears it on a cord. Red plume, you can\'t miss him.',
          'Bring it back and she\'s yours to ride. I\'m too old for the road.',
        ],
        effect: () => q.start('steed'),
      };
    }
    if (q.status('steed') === 'active' && g.hasItem('bone_whistle')) {
      return {
        name,
        lines: [
          'That sound. You blew it on the way here, didn\'t you? I heard her answer.',
          'Keep it. She won\'t come to me anymore anyway. Call her with the whistle and she\'ll carry you.',
          'One thing. She won\'t go near the Warden\'s mist. None of the dead will.',
        ],
        effect: () => q.complete('steed'),
      };
    }
    if (q.status('steed') === 'active') {
      return { name, lines: ['The watch ruins are east of the old road. The captain has my whistle. Red plume.'] };
    }
    // After the steed: two more favours, one at a time.
    if (q.status('acolytes') === 'inactive') {
      return {
        name,
        lines: [
          'You\'ve seen the ones with the lanterns? Robes, hoods, a light that never gutters.',
          'They were monks once. Rang the hours at the chapel. Now they throw fire at anyone on the road.',
          'Four of them, last I counted. Two in the ruins, two by the graves near the gate. Put the lights out.',
        ],
        effect: () => q.start('acolytes'),
      };
    }
    if (q.status('letter') === 'inactive') {
      return {
        name,
        lines: [
          'One more thing, and don\'t make a face.',
          'There\'s a sister camped by the lake. Ilse. I wrote her something. My knees won\'t take the ride and Wisp won\'t carry an old man anymore.',
          'Don\'t read it. I\'ll know.',
        ],
        effect: () => {
          q.start('letter');
          g.giveItem('brannoc_letter');
        },
      };
    }
    if (q.status('letter') === 'active') {
      return { name, lines: ['The letter. The lake. Go on, before I change my mind about it.'] };
    }
    if (q.status('acolytes') === 'active') {
      return { name, lines: ['The lantern monks are still out there. The ruins, and the graves by the gate.'] };
    }
    return {
      name,
      lines: [
        g.state.flags.wardenDead
          ? 'I heard the bell stop. First time in forty years. I didn\'t like the quiet as much as I thought I would.'
          : 'Ride her hard. She likes it. Just don\'t ask her to cross the mist.',
      ],
    };
  },

  ilse(g) {
    const q = g.quests;
    const name = 'Sister Ilse';
    if (q.status('locket') === 'inactive') {
      return {
        name,
        lines: [
          'Oh. You\'re real. I keep hearing footsteps out here and then nobody.',
          'Our cart went over on the western moor. The others ran. I ran too. I left my locket in the wreck.',
          'It\'s only silver. It isn\'t worth anything. But I\'d be grateful if you looked. The wreck is southwest of the lake, past the dead trees.',
        ],
        effect: () => q.start('locket'),
      };
    }
    if (q.status('locket') === 'active' && g.hasItem('locket')) {
      return {
        name,
        lines: [
          'You found it. You actually found it.',
          'Here. Hold out your flask. This is sunmoss from my mother\'s garden. It keeps longer than it should.',
          'There. It\'ll hold one more draught for you now.',
        ],
        effect: () => {
          g.takeItem('locket');
          q.complete('locket');
        },
      };
    }
    if (q.status('locket') === 'active') {
      return { name, lines: ['The wreck is southwest, on the moor. Be careful. Something was still moving out there.'] };
    }
    // Hand-ins first, so a visit never wastes a delivery.
    if (q.status('letter') === 'active' && g.hasItem('brannoc_letter')) {
      return {
        name,
        lines: [
          'A letter? For me? Nobody has written to me since the gate closed.',
          'Oh. Oh, the old fool. He remembers the chapel choir. He remembers me singing in it.',
          'Tell him... no. I\'ll tell him myself. Thank you for carrying it.',
        ],
        effect: () => {
          g.takeItem('brannoc_letter');
          q.complete('letter');
        },
      };
    }
    if (q.status('bell') === 'active' && g.hasItem('bell_shard')) {
      return {
        name,
        lines: [
          'That\'s from the chapel bell. I can hear it. Can you hear it?',
          'It cracked because it was trying to warn us. The night the Warden came it rang until it broke.',
          'Give me your flask. A little of this ground into the sunmoss and the draught will last longer. The bell would want to be useful.',
        ],
        effect: () => {
          g.takeItem('bell_shard');
          q.complete('bell');
        },
      };
    }
    if (q.status('hounds') === 'inactive') {
      return {
        name,
        lines: [
          'Do you hear them at night? The hounds. Grey things, all ribs and spurs.',
          'Two of them circle my fire. More on the moor road. They wait for me to fall asleep.',
          'If you could thin the packs, I might sleep. Five should do it.',
        ],
        effect: () => q.start('hounds'),
      };
    }
    if (q.status('hounds') === 'done' && q.status('mother') === 'inactive') {
      return {
        name,
        lines: [
          'Thank you. Truly. But I counted them again last night. There were more.',
          'The old lake-watchers had a story: the hounds are all one litter, whelped by a mother as big as a cart, asleep in the Ashen Fen past the Watch Ruins.',
          'Follow the road east of the ruins, past the fen shrine. If she\'s real, she won\'t stay asleep for long once you step into her hollow.',
        ],
        effect: () => {
          q.start('mother');
          if (g.state.flags.motherDead) q.complete('mother'); // already beaten before anyone asked
        },
      };
    }
    if (q.status('mother') === 'active') {
      return { name, lines: ['The fen road runs east from the Watch Ruins. Be careful in the hollow. Mothers fight hardest of all.'] };
    }
    if (q.status('bell') === 'inactive') {
      return {
        name,
        lines: [
          'There\'s a chapel on the rise north of the lake. Roofless now.',
          'The night the Warden took the gate, its bell rang by itself until it cracked. I was a novice there. I ran.',
          'I\'ve never been brave enough to go back. Would you? Tell me what\'s left of it.',
        ],
        effect: () => q.start('bell'),
      };
    }
    if (q.status('hounds') === 'active') {
      return { name, lines: ['The hounds are still out there. The shore and the moor road.'] };
    }
    if (q.status('bell') === 'active') {
      return { name, lines: ['The chapel is on the rise north of the lake. The bell lies in the grass, where it fell.'] };
    }
    return {
      name,
      lines: [g.state.flags.wardenDead ? 'The bells stopped. Did you do that? Then the road north is open. I might follow, one day.' : 'I\'ll rest here a while longer. The lake is quiet.'],
    };
  },

  chapel_bell(g) {
    const q = g.quests;
    const name = 'The Cracked Bell';
    const examining = q.status('bell') === 'active' && q.stageDef('bell')?.on.id === 'chapel_bell';
    if (examining) {
      return {
        name,
        lines: [
          'The bell lies on its side in the long grass, taller than you. A crack runs from lip to crown.',
          'Words are cut around the rim: "I ring for those who cannot." The bronze is warm, though the evening is cold.',
          'A shard has broken free along the crack. When you lift it, the whole bell hums.',
        ],
        effect: () => {
          g.giveItem('bell_shard');
          q.advance('bell');
        },
      };
    }
    return {
      name,
      lines: ['The bell lies cracked in the grass. Around the rim: "I ring for those who cannot."'],
    };
  },

  notice(g) {
    const q = g.quests;
    const name = 'Notice';
    if (q.status('sentries') === 'inactive') {
      return {
        name,
        lines: [
          '"BOUNTY. The hollow sentries of the old watchtower have taken to the road. Five of them put down earns the bearer four hundred ash, paid at any lantern, and the lantern-keeper will teach the bearer a rite of fire."',
          'Below, in a different hand: "they get back up."',
        ],
        effect: () => q.start('sentries'),
      };
    }
    if (q.status('sentries') === 'active') return { name, lines: ['The bounty still stands. Five sentries.'] };
    return { name, lines: ['Someone has scrawled "PAID" across the notice.'] };
  },

  castle() {
    return {
      name: 'Castle Dunmarrow',
      lines: ['The great doors are barred from within. Somewhere behind the walls, a bell answers the Warden\'s. While he keeps the gate, these will not open.'],
    };
  },

  ormund(g) {
    const q = g.quests;
    const name = 'Ormund, Ice-Cutter';
    if (q.status('brother') === 'active' && g.hasItem('brothers_lantern')) {
      return {
        name,
        lines: [
          'That\'s Eskil\'s lantern. The dent on the hood is from when he dropped it down the well. He was eight.',
          'So he got as far as the steps. Further than me.',
          'Take this. He made it for cutting the ice by the hall. It cuts other things too.',
        ],
        effect: () => {
          g.takeItem('brothers_lantern');
          q.complete('brother');
        },
      };
    }
    if (q.status('brother') === 'inactive') {
      return {
        name,
        lines: [
          'Through the castle and alive? Then the Warden is gone. Good riddance to his bells.',
          'I cut ice on the tarn. My brother Eskil went north to the hall with his lantern, to see if the Winter Lantern still burns. That was two winters back.',
          'If you go that way, look for a little brass lantern on the steps. I would like it back, whatever else you find.',
        ],
        effect: () => q.start('brother'),
      };
    }
    if (q.status('troll') === 'inactive') {
      return {
        name,
        lines: [
          'And watch the field to the east. Something big lives out there. It throws the ice I cut back at me.',
          'Kill it and I will give you every flask I have hoarded. Which is one.',
        ],
        effect: () => q.start('troll'),
      };
    }
    if (q.status('brother') === 'active') return { name, lines: ['The hall is due north, up the old road past the frozen statues. Eskil\'s lantern is brass, with a dent in the hood.'] };
    if (q.status('troll') === 'active') return { name, lines: ['The Howling Field is east of the road. You will hear it before you see it.'] };
    return {
      name,
      lines: [g.state.flags.saelithDead ? 'The cold is going out of the wind. First time I have seen the tarn sweat in years.' : 'The Winter Lantern still burns in the hall. As long as it does, the snow will not leave.'],
    };
  },

  hessa(g) {
    const q = g.quests;
    const name = 'Hessa, Smith of the Sunken Forge';
    const drakeDead = g.state.flags.ashmawDead;
    if (q.status('ashmaw') === 'inactive') {
      return {
        name,
        lines: [
          'Mind the trough. That water hasn\'t been cold since my grandmother\'s time.',
          'This was the Sunken Forge. Smiths came from all over the Vale to work at a fire that never went out. The fire was Ashmaw\'s: the drake sleeps in the caldera under the mountain, and its heat came up through the rock to us.',
          'Then it woke hungry, and the Wastes are what it left. I\'m the last smith here. I stay because the anvil does.',
          drakeDead ? 'And you\'ve already... the mountain\'s gone quiet. That was you? Then the Old Fire is out.' : 'Go down into the caldera and put the Old Fire out. Kindle the shrine on the steps first; you\'ll be back there more than once.',
          'And bring me smithing stones, the dark ore with light in it. Lay them on the anvil with your weapon and I\'ll make it bite.',
        ],
        effect: () => {
          q.start('ashmaw');
          if (drakeDead) q.complete('ashmaw');
        },
      };
    }
    if (q.status('ashmaw') === 'active' && drakeDead) {
      return {
        name,
        lines: [
          'I felt it go. The floor went cold under my feet for the first time in my life.',
          'You\'d think a smith would be sorry. I\'m not. Here: everything I\'d saved for a day like this.',
        ],
        effect: () => q.complete('ashmaw'),
      };
    }
    if (q.status('golems') === 'inactive') {
      return {
        name,
        lines: [
          'One more thing, while you\'re walking the Wastes.',
          'The forge made golems once: black stone with a coal for a heart, to carry ore. Two of them are still walking out there and they don\'t know who they\'re carrying it for any more.',
          'Break them. Bring me nothing; the stones they\'re made of are no use. I\'ll pay you in the good kind.',
        ],
        effect: () => q.start('golems'),
      };
    }
    if (q.status('ashmaw') === 'active') return { name, lines: ['The caldera is south, under the smoke. You\'ll hear it breathing before you see it.', 'Use the anvil if you have stones. Your weapon on it, the stones beside it.'] };
    return {
      name,
      lines: [
        g.state.inventory.smithing_stone ? 'You\'ve stones with you. The anvil\'s there; lay your weapon on it.' : 'Smithing stones lie where the land is old: the Wastes, the coast, the Hollows, the far edges of the Vale. Look for the light in them.',
      ],
    };
  },

  wenna(g) {
    const q = g.quests;
    const name = 'Old Wenna, last of Saltmarrow';
    if (q.status('tides') === 'active' && g.hasItem('drowned_bell')) {
      return {
        name,
        lines: [
          'Oh. Oh, you found it. It\'s smaller than I remember. Everything is.',
          'It rang every evening when the boats came in. Then one night it rang for Morrow\'s ship, and the ship didn\'t stop.',
          'Thank you. Have this; I\'ve no use for it, but you look like you\'ll need it.',
        ],
        effect: () => {
          g.takeItem('drowned_bell');
          q.complete('tides');
        },
      };
    }
    if (q.status('tides') === 'inactive') {
      return {
        name,
        lines: [
          'A living face. I\'d nearly forgotten what one looks like.',
          'This was Saltmarrow. Fishers, all of us. Now it\'s me, and the ones the sea gave back, and they don\'t talk.',
          'Our harbour bell went into the sea the night the Captain\'s ship came ashore. The tide brings things back to the end of the old pier sometimes. If it brings the bell, I\'d like it.',
        ],
        effect: () => q.start('tides'),
      };
    }
    if (q.status('morrow') === 'inactive') {
      const dead = g.state.flags.morrowDead;
      return {
        name,
        lines: dead
          ? ['The Captain\'s gone quiet. I watched the tide go out and out last night and come back clean. That was you.', 'My sister would have thanked you. I will instead.']
          : [
            'You\'ve seen them on the beach. The drowned. That was his crew.',
            'Captain Morrow married my sister. He ran his ship onto the rocks on a clear night, and every one of them came walking back out of the sea, and him the last.',
            'He stands by the wreck south of the lighthouse looking out to sea. Send him back to it. Please.',
          ],
        effect: () => {
          q.start('morrow');
          if (dead) q.complete('morrow');
        },
      };
    }
    if (q.status('tides') === 'active') return { name, lines: ['The pier\'s the broken one north of the houses. The tide leaves things at the end of it.'] };
    if (q.status('morrow') === 'active') return { name, lines: ['South along the strand, past the lighthouse. The wreck is the big one. He\'ll be there; he always is.'] };
    return { name, lines: [g.state.flags.morrowDead ? 'The gulls came back this morning. First time in years.' : 'Mind the crabs. They\'ve got bold.'] };
  },

  murk(g) {
    const q = g.quests;
    const name = 'Murk, a Myconid';
    if (q.status('stalkers') === 'inactive') {
      return {
        name,
        lines: [
          '...Hmmm. You are warm. Warm things do not usually come into the Hollows. Hmmm.',
          'I am Murk. I am a Myconid. We grew here, many of us, under the caps. Now there is me, and the ring, and the ones who drift.',
          'The drifting ones were Myconids too. The Bloom Witch\'s spores got into them. They do not know me now. Please... let them rest.',
        ],
        effect: () => q.start('stalkers'),
      };
    }
    if (q.status('bloom') === 'inactive') {
      const dead = g.state.flags.sylvaraDead;
      return {
        name,
        lines: dead
          ? ['...The grove is quiet. I felt it through the roots. Hmmm. Thank you, warm one.']
          : [
            'Hmmm. You should know about the grove.',
            'A woman came into the Hollows, long ago, and slept under the great Heartcap. When she woke she was more cap than woman. Sylvara, she calls herself. Her spores are what turned the drifting ones.',
            'She is at the end of the Hollows, in the Heartcap Grove. Kindle the old shrine on the way. And... be kind, if you can. She was someone, once.',
          ],
        effect: () => {
          q.start('bloom');
          if (dead) q.complete('bloom');
        },
      };
    }
    if (q.status('bloom') === 'active' && g.state.flags.sylvaraDead) {
      return {
        name,
        lines: [
          '...She is gone. I felt the Heartcap let go of her. Hmmm.',
          'Take this. A spore from the Heartcap itself. It will grow into something better than she did. Thank you, warm one.',
        ],
        effect: () => q.complete('bloom'),
      };
    }
    if (q.status('stalkers') === 'active') return { name, lines: ['Hmmm. The drifting ones keep to the deep caps, west of the ring.'] };
    if (q.status('bloom') === 'active') return { name, lines: ['The grove is at the end of the road, where the light turns pink. Hmmm.'] };
    return { name, lines: ['Hmmm. The caps are growing back. Slowly. That is the right speed.'] };
  },
};
