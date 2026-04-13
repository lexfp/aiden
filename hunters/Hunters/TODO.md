# Hunters Storyline Mode Implementation - BLACKBOXAI TRACKER

## APPROVED PLAN BREAKDOWN (10 Steps from Original TODO)

### Completed (1/10) ✅
- [x] 1. Update buildPreplayUI() to populate #chapter-row with STORY_CHAPTERS
  - Shows 5 chapters, locks future ones
  - Current chapter highlighted with progress %
  - Sets G.selChapter on select
  - Only visible in storyline mode

### In Progress (0/10)

### Remaining (9/10) ⏳
- [ ] 2. Create startStorylineChapter() → Override selMap/selDiff/selBots/selWaves from current chapter → Call startMatch()
- [ ] 3. Update startMatch() for selMode==='storyline': Init chapterProgress=0, requiredKills=(bots*waves), bossList=chapter.bosses, show first dialogue, spawn first wave as 'story_surv'
- [ ] 4. Add updateStoryHUD() → Toggle #story-hud visibility, set chap name/progress bar in renderLoop/updateHUD()
- [ ] 5. Update spawnWave() for storyline: Use chapter.bots remaining, JJK types/bosses on final wave, show wave dialogue
- [ ] 6. Storyline win condition: On waves complete → chapterProgress++, if full chapter: storyChapter++, show recap, x2 coins, save
- [ ] 7. Update game over recap (#story-recap): Chapter complete msg, next unlock preview, chapter stats
- [ ] 8. Edge cases: Replay current chapter (reset progress), lock future in UI, save validation
- [ ] 9. Helpers: showChapterDialogue(), advanceStoryChapter(), resetChapterProgress()
- [ ] 10. Polish & testing: Test 5 chapters progression, mobile UI, transitions/celebrations

## EXECUTION STEPS (BLACKBOXAI Order)
1. ✅ Create this TODO.md
2. Implement Steps 1-2: Chapter UI + startStorylineChapter → Test preplay/start
3. Update TODO.md (mark complete)
4. Steps 3-4: startMatch + HUD → Test match HUD/dialogue
5. Update TODO.md
6. Steps 5-6: Spawning + completion → Test waves/progress/advance
7. Update TODO.md
8. Steps 7-10: Recap/edges/polish → Full test all chapters
9. Update TODO.md (all ✅)
10. attempt_completion

**Next: Edit hunters-game.js for Steps 1-2. Confirm before edits?**

