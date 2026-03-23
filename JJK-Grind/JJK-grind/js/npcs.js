// ═══════════════════ NPC & QUEST SYSTEM ═══════════════════
const NPCS = [
  { id: 'gojo', name: 'Satoru Gojo', title: 'The Strongest', x: 25, z: 25, theme: 'city', hair: 0xffffff, eye: 0x66ccff,
    dialogIdle: "Hey there! Ready to exorcise some curses?",
    quest: { id: 'q_kill_10', desc: "Exorcise 10 enemies.", type: 'kill', target: 10, rewardXP: 800, rewardCoins: 150 },
    dialogActive: "Keep at it! Those curses won't exorcise themselves.",
    dialogDone: "Nice work! Here's your reward, keep grinding!"
  },
  { id: 'nanami', name: 'Kento Nanami', title: 'Grade 1 Sorcerer', x: 25, z: -25, theme: 'city', hair: 0xddcc99, eye: 0x222222,
    dialogIdle: "Overtime is a binding vow.",
    quest: { id: 'q_kill_pvp_2', desc: "Defeat 2 Elite PvP Sorcerers.", type: 'kill_pvp', target: 2, rewardXP: 1500, rewardCoins: 400 },
    dialogActive: "You still have targets remaining. Do not waste my time.",
    dialogDone: "Adequate work. You may go now."
  },
  { id: 'maki', name: 'Maki Zenin', title: 'Cursed Tools Master', x: -25, z: 25, theme: 'city', hair: 0x116633, eye: 0x225522,
    dialogIdle: "Don't just stand there. Show me what you've got.",
    quest: { id: 'q_combo_20', desc: "Achieve a 20-hit combo.", type: 'combo', target: 20, rewardXP: 600, rewardCoins: 100 },
    dialogActive: "A 20-hit combo. It's not that hard if you actually try.",
    dialogDone: "Not bad. You're learning."
  }
];

let activeQuest = null; // { id, progress, target, obj }
let activeNPC = null;
let dialogOpen = false;

function initNPCs() {
  NPCS.forEach(npc => {
    // Find theme island safely
    const isl = ISLANDS.find(i => i.theme === npc.theme) || SAFE_ISLAND;
    npc.mesh = buildStaticSorcerer(isl.x + npc.x, isl.z + npc.z, npc.hair, npc.eye);
    npc.mesh.userData.npc = npc;
    npc.worldX = isl.x + npc.x;
    npc.worldZ = isl.z + npc.z;
    npc.mesh.rotation.y = Math.atan2( -npc.worldX, -npc.worldZ ); // Face center
  });
}

function updateNPCs(dt) {
  if (!player || !player.group) return;
  
  let closest = null;
  let minDist = 15; // Interaction range

  NPCS.forEach(n => {
    const dist = Math.sqrt((player.group.position.x - n.worldX)**2 + (player.group.position.z - n.worldZ)**2);
    if (dist < minDist) { minDist = dist; closest = n; }
  });

  const prompt = document.getElementById('interact-prompt');
  
  if (closest && !dialogOpen) {
    activeNPC = closest;
    if(prompt) {
       prompt.style.display = 'block';
       prompt.innerText = `[G] Talk to ${closest.name}`;
    }
  } else {
    activeNPC = null;
    if(prompt) prompt.style.display = 'none';
    if(dialogOpen && (!closest || minDist > 20)) closeDialog(); // Auto-close if walk away
  }
}

function interactWithNPC() {
  if (!activeNPC) return;
  if (dialogOpen) { closeDialog(); return; }

  dialogOpen = true;
  document.getElementById('interact-prompt').style.display = 'none';
  document.getElementById('dialog-ui').style.display = 'block';
  document.getElementById('dialog-name').innerText = `${activeNPC.title} — ${activeNPC.name}`;

  // Quest Logic
  if (!activeQuest) {
    // Give Quest
    document.getElementById('dialog-text').innerText = activeNPC.dialogIdle + `\n\n[NEW QUEST] ${activeNPC.quest.desc} \nRewards: ${activeNPC.quest.rewardXP} XP, ${activeNPC.quest.rewardCoins} 🪙`;
    activeQuest = { npcId: activeNPC.id, obj: activeNPC.quest, progress: 0 };
    updateQuestUI();
  } else if (activeQuest.npcId === activeNPC.id) {
    // Checking status with quest giver
    if (activeQuest.progress >= activeQuest.obj.target) {
      // Turn in
      document.getElementById('dialog-text').innerText = activeNPC.dialogDone;
      player.xp += activeQuest.obj.rewardXP;
      player.coins += activeQuest.obj.rewardCoins;
      checkLevelUp();
      showAnnouncement(`Quest Complete! +${activeQuest.obj.rewardXP} XP, +${activeQuest.obj.rewardCoins} 🪙`, '#44ffaa');
      activeQuest = null; // Reset slot
      updateQuestUI();
    } else {
      // Still active
      document.getElementById('dialog-text').innerText = activeNPC.dialogActive + `\n\nProgress: ${activeQuest.progress} / ${activeQuest.obj.target}`;
    }
  } else {
    // Busy with another quest
    document.getElementById('dialog-text').innerText = activeNPC.dialogIdle + "\n\n(You are already on a quest for someone else.)";
  }
}

function closeDialog() {
  dialogOpen = false;
  document.getElementById('dialog-ui').style.display = 'none';
}

function updateQuestProgress(type, amount=1) {
  if (!activeQuest) return;
  if (activeQuest.obj.type === type) {
    // Special handling for combo (must hit max at once)
    if (type === 'combo') {
      if (amount >= activeQuest.obj.target) activeQuest.progress = activeQuest.obj.target;
    } else {
      activeQuest.progress = Math.min(activeQuest.progress + amount, activeQuest.obj.target);
    }
    updateQuestUI();
  }
}

function updateQuestUI() {
  let ui = document.getElementById('quest-tracker');
  if (!ui) {
    ui = document.createElement('div');
    ui.id = 'quest-tracker';
    ui.style.cssText = "position:absolute; top:20px; right:20px; text-align:right; font-family:'Courier New', monospace; color:#fff; font-weight:bold; font-size:14px; text-shadow:1px 1px 3px #000; padding:10px; background:rgba(0,0,0,0.5); border-left:3px solid #ffaa00;";
    document.getElementById('ui').appendChild(ui);
  }
  
  if (!activeQuest) {
    ui.style.display = 'none';
  } else {
    ui.style.display = 'block';
    const color = activeQuest.progress >= activeQuest.obj.target ? '#44ffaa' : '#ffaa00';
    ui.innerHTML = `<span style="color:#aaa;font-size:11px;">ACTIVE QUEST</span><br>
                    <span style="color:${color}">${activeQuest.obj.desc}</span><br>
                    ${activeQuest.progress} / ${activeQuest.obj.target}`;
  }
}
