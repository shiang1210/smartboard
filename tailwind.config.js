/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          th: {
            primary: 'var(--th-primary)', primaryHover: 'var(--th-primary-hover)', primaryText: 'var(--th-primary-text)', primaryShade: 'var(--th-primary-shade)',
            sec: 'var(--th-sec)', secHover: 'var(--th-sec-hover)', secText: 'var(--th-sec-text)', secBorder: 'var(--th-sec-border)', secShade: 'var(--th-sec-shade)',
            danger: 'var(--th-danger)', dangerHover: 'var(--th-danger-hover)', dangerText: 'var(--th-danger-text)', dangerShade: 'var(--th-danger-shade)',
            text: 'var(--th-text)', textSec: 'var(--th-text-sec)',
            topbar: 'var(--th-topbar)', topbarBorder: 'var(--th-topbar-border)', topbarText: 'var(--th-topbar-text)',
            panel: 'var(--th-panel)', panelBorder: 'var(--th-panel-border)',
            board: 'var(--th-board)', boardBorder: 'var(--th-board-border)',
            boardTitle: 'var(--th-board-title)', boardItem: 'var(--th-board-item)', boardItemText: 'var(--th-board-item-text)',
            boardTag: 'var(--th-board-tag)', boardTagText: 'var(--th-board-tag-text)',
            taskBg: 'var(--th-task-bg)', taskBorder: 'var(--th-task-border)', taskTag: 'var(--th-task-tag)', taskTagText: 'var(--th-task-tag-text)', itemBorder: 'var(--th-item-border)',
            collectBorder: 'var(--th-collect-border)', collectTitle: 'var(--th-collect-title)',
            collectActive: 'var(--th-collect-active)', collectInactive: 'var(--th-collect-inactive)',
            collectNumActive: 'var(--th-collect-num-active)', collectNumInactive: 'var(--th-collect-num-inactive)',
            collectTagActive: 'var(--th-collect-tag-active)', collectTagActiveText: 'var(--th-collect-tag-active-text)',
            collectTagInactive: 'var(--th-collect-tag-inactive)', collectTagInactiveText: 'var(--th-collect-tag-inactive-text)',
            tabActive: 'var(--th-tab-active)', tabActiveText: 'var(--th-tab-active-text)', tabActiveBorder: 'var(--th-tab-active-border)',
            tabInactive: 'var(--th-tab-inactive)', tabInactiveHover: 'var(--th-tab-inactive-hover)',
            rewardBg: 'var(--th-reward-bg)', rewardBorder: 'var(--th-reward-border)', rewardScoreBg: 'var(--th-reward-score-bg)'
          }
        }
      },
    },
    plugins: [],
  }
  