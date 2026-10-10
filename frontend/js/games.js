/* Carousel cover game yang tersedia di frontend/assets/game-cover. */
const GAME_COVERS = [
  ['A Way Out', 'awayout.png'],
  ['Call of Duty: Black Ops II', 'codblackops2.png'],
  ['Call of Duty: Modern Warfare', 'codmw.png'],
  ['Crash Team Racing', 'ctr.png'],
  ['eFootball', 'efootball.png'],
  ['EA Sports FC 26', 'fc26.png'],
  ['Ghost of Tsushima', 'ghostoftsushima.png'],
  ['God of War Ragnarök', 'godofwar_ragnarok.png'],
  ['Grand Theft Auto V', 'gtav.png'],
  ['It Takes Two', 'ittakestwo.png'],
  ['MotoGP', 'motogp.png'],
  ['Naruto', 'naruto.jpg'],
  ['Red Dead Redemption 2', 'rdr2.png'],
  ['Marvel’s Spider-Man', 'spiderman.png'],
  ['Tekken 7', 'tekken7.jpg'],
  ['The Last of Us', 'thelastofus.png'],
  ['UFC', 'ufc.png'],
];

const gamesCarousel = document.getElementById('gamesCarousel');
const gamesPagination = document.getElementById('gamesPagination');
let activeGameIndex = 13;
const mobileGamesQuery = window.matchMedia('(max-width: 600px)');

function renderGames() {
  if (!gamesCarousel) return;
  const total = GAME_COVERS.length;
  if (!gamesCarousel.childElementCount) {
    gamesCarousel.innerHTML = GAME_COVERS.map(([name, file], index) => `
      <button class="game-cover-card" type="button" data-game-index="${index}" aria-label="${name}">
        <span class="game-cover-art"><img src="assets/game-cover/${file}" alt="" loading="lazy" /></span>
        <span class="game-cover-caption"><span class="game-cover-name">${name}</span></span>
      </button>`).join('');
    if (gamesPagination) {
      gamesPagination.innerHTML = GAME_COVERS.map(([name], index) =>
        `<button class="games-dot" type="button" aria-label="Tampilkan ${name}" onclick="showGame(${index})"></button>`
      ).join('');
    }
  }

  [...gamesCarousel.children].forEach((card, index) => {
    let offset = index - activeGameIndex;
    if (offset > total / 2) offset -= total;
    if (offset < -total / 2) offset += total;
    const distance = Math.abs(offset);
    const visibleDistance = mobileGamesQuery.matches ? 2 : 4;
    const desktopPositions = [0, 116, 198, 274, 344];
    const mobilePositions = [0, 78, 132];
    const desktopScales = [1, 0.9, 0.8, 0.69, 0.58];
    const mobileScales = [1, 0.86, 0.72];
    const desktopTints = [0, 0.2, 0.4, 0.62, 0.82];
    const mobileTints = [0, 0.3, 0.58];
    const desktopShift = desktopPositions[distance] ?? 344 + (distance - 4) * 60;
    const mobileShift = mobilePositions[distance] ?? 132 + (distance - 2) * 40;
    card.style.setProperty('--shift', `${Math.sign(offset) * desktopShift}px`);
    card.style.setProperty('--mobile-shift', `${Math.sign(offset) * mobileShift}px`);
    card.style.setProperty('--scale', String(distance <= visibleDistance ? (mobileGamesQuery.matches ? mobileScales[distance] : desktopScales[distance]) : 0));
    card.style.setProperty('--tint', String(distance <= visibleDistance ? (mobileGamesQuery.matches ? mobileTints[distance] : desktopTints[distance]) : 1));
    card.style.setProperty('--layer', String(Math.max(1, 5 - distance)));
    card.classList.toggle('is-active', offset === 0);
    card.setAttribute('aria-current', String(offset === 0));
    const interactive = distance <= visibleDistance;
    card.setAttribute('aria-hidden', String(!interactive));
    card.tabIndex = interactive ? 0 : -1;
    card.style.pointerEvents = interactive ? 'auto' : 'none';
    const image = card.querySelector('img');
    if (image) image.loading = distance < 2 ? 'eager' : 'lazy';
  });

  if (gamesPagination) {
    [...gamesPagination.children].forEach((dot, index) => {
      dot.classList.toggle('active', index === activeGameIndex);
      dot.setAttribute('aria-current', String(index === activeGameIndex));
    });
  }
}

function showGame(index) {
  activeGameIndex = (index + GAME_COVERS.length) % GAME_COVERS.length;
  renderGames();
}

function changeGame(direction) {
  showGame(activeGameIndex + direction);
}

gamesCarousel?.addEventListener('click', event => {
  const card = event.target.closest('[data-game-index]');
  if (card) showGame(Number(card.dataset.gameIndex));
});
gamesCarousel?.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    changeGame(event.key === 'ArrowRight' ? 1 : -1);
  }
});
mobileGamesQuery.addEventListener?.('change', renderGames);

renderGames();
