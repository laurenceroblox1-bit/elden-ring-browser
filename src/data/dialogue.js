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
    return {
      name,
      lines: [g.state.flags.wardenDead ? 'The bells stopped. Did you do that? Then the road north is open. I might follow, one day.' : 'I\'ll rest here a while longer. The lake is quiet.'],
    };
  },

  notice(g) {
    const q = g.quests;
    const name = 'Notice';
    if (q.status('sentries') === 'inactive') {
      return {
        name,
        lines: [
          '"BOUNTY. The hollow sentries of the old watchtower have taken to the road. Five of them put down earns the bearer four hundred ash, paid at any lantern."',
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
      lines: ['The great doors are barred from within. Beyond them lies the next region of the Vale, which is not built yet.'],
    };
  },
};
