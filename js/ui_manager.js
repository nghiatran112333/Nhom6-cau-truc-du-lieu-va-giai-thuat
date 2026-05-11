export const UI = {
    startBtn: document.getElementById('start-btn'),
    mazeBtn: document.getElementById('maze-btn'),
    resetBtn: document.getElementById('reset-btn'),
    algorithmSelect: document.getElementById('algorithm'),
    pathCostDisplay: document.getElementById('path-cost'),
    pathLengthDisplay: document.getElementById('path-length'),
    nodesVisitedDisplay: document.getElementById('nodes-visited'),
    brushBtns: document.querySelectorAll('.brush-btn'),
    modal: document.getElementById('comparison-modal'),
    showBtn: document.getElementById('show-comparison'),
    closeBtn: document.getElementsByClassName('close-modal')[0],
    
    // Live comparison elements
    bfsSteps: document.getElementById('live-bfs-steps'),
    bfsNodes: document.getElementById('live-bfs-nodes'),
    dfsSteps: document.getElementById('live-dfs-steps'),
    dfsNodes: document.getElementById('live-dfs-nodes'),
    
    // Music controls
    musicToggle: document.getElementById('music-toggle'),
    musicVolume: document.getElementById('music-volume'),
    musicTitle: document.getElementById('music-title')
};

export function initUI(callbacks) {
    UI.mazeBtn.addEventListener('click', callbacks.onGenerateMaze);
    UI.resetBtn.addEventListener('click', callbacks.onReset);
    UI.startBtn.addEventListener('click', callbacks.onStartSearch);

    UI.brushBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            UI.brushBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            callbacks.onBrushChange(btn.dataset.type);
        });
    });

    UI.showBtn.onclick = () => {
        UI.modal.style.display = 'block';
        callbacks.onModalOpen();
    };
    UI.closeBtn.onclick = () => UI.modal.style.display = 'none';
    window.onclick = (e) => { if (e.target == UI.modal) UI.modal.style.display = 'none'; };

    // Music Event Listeners
    UI.musicToggle.addEventListener('click', () => {
        const isPlaying = callbacks.onMusicToggle();
        UI.musicToggle.innerText = isPlaying ? '⏸️' : '🎵';
    });

    UI.musicVolume.addEventListener('input', (e) => {
        callbacks.onVolumeChange(parseFloat(e.target.value));
    });
}
