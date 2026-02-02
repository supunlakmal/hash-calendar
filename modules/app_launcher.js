import { onLanguageChange, t } from './i18n.js';

export class AppLauncher {
    constructor() {
        this.apps = [
            {
                nameKey: 'app.calendar',
                url: 'https://hash-calendar.netlify.app/',
                icon: 'fa-solid fa-calendar-days',
                color: '#1a73e8'
            },
            {
                nameKey: 'app.spreadsheet',
                url: 'https://spreadsheetlive.netlify.app/',
                icon: 'fa-solid fa-table-cells',
                color: '#107c41'
            }
        ];

        this.init();
        onLanguageChange(() => this.renderMenu());
    }



    init() {
        this.renderMenu();
        this.setupEventListeners();
    }

    renderMenu() {
        const menuContainer = document.getElementById('app-launcher-menu');
        if (!menuContainer) return;

        // Clear existing content just in case
        menuContainer.innerHTML = '';

        // Create the grid
        const grid = document.createElement('div');
        grid.className = 'app-launcher-grid';

        this.apps.forEach(app => {
            const appItem = document.createElement('a');
            appItem.href = app.url;
            appItem.target = '_blank';
            appItem.className = 'app-launcher-item';
            appItem.rel = 'noopener noreferrer';
            
            appItem.innerHTML = `
                <div class="app-icon-wrapper" style="background-color: ${app.color}15; color: ${app.color}">
                    <i class="${app.icon}"></i>
                </div>
                <span class="app-name">${window.t ? window.t(app.nameKey) : app.nameKey}</span>
            `;

            grid.appendChild(appItem);
        });

        menuContainer.appendChild(grid);
        
        // Add a "More apps" placeholder if needed or footer
        // For now, simple grid is fine.
    }

    setupEventListeners() {
        const btn = document.getElementById('app-launcher-btn');
        const menu = document.getElementById('app-launcher-menu');

        if (!btn || !menu) return;

        // Toggle menu
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = menu.classList.contains('hidden');
            
            // Close all other open menus/modals if needed (optional, keeping it simple)
            
            if (isHidden) {
                this.openMenu();
            } else {
                this.closeMenu();
            }
        });

        // Close on click outside
        document.addEventListener('click', (e) => {
            if (!menu.classList.contains('hidden') && !menu.contains(e.target) && !btn.contains(e.target)) {
                this.closeMenu();
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !menu.classList.contains('hidden')) {
                this.closeMenu();
            }
        });
    }

    openMenu() {
        const menu = document.getElementById('app-launcher-menu');
        const btn = document.getElementById('app-launcher-btn');
        
        menu.classList.remove('hidden');
        btn.setAttribute('aria-expanded', 'true');
        
        // Slight animation class if we want to trigger CSS animations explicitly
        // CSS transition on opacity/transform is usually enough if not display:none
        // But since we use 'hidden' (display: none), we might need a small timeout for transition
        // For simplicity, we'll rely on CSS animation on the 'hidden' removal or separate class.
        // Let's assume standard toggle for now.
    }

    closeMenu() {
        const menu = document.getElementById('app-launcher-menu');
        const btn = document.getElementById('app-launcher-btn');
        
        menu.classList.add('hidden');
        btn.setAttribute('aria-expanded', 'false');
    }
}
