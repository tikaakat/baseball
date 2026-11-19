/*
 * はじめての人向けの操作ガイド（最初に試合を観るときだけ、3ステップで説明）。
 * 表示済みかどうかはこの端末のブラウザに覚えておく（使えない環境では毎回出さないよう、その場限り）。
 */
const KEY = 'pencil-baseball:guide-done';
let shownThisSession = false;

const STEPS = [
  { title: 'これが「打者の鉛筆」', body: 'いま打席に立っている打者の鉛筆です。色の帯は各面の出やすさ。ミートが高い打者はヒット、パワーがある打者は「おっと」とHRの面が大きくなります。相手投手の球威・制球、疲れ具合もここに反映されます。' },
  { title: '鉛筆を転がす', body: '画面下のボタンで1本目を転がします。「おっと」が出たら2本目へ。2本目で長打や本塁打が出ることも。長押しすると早送りできます。' },
  { title: '勝負所では監督に', body: '終盤の接戦で走者がいると「勝負所カード」が出ます。代打・盗塁・バント・継投・敬遠を、鉛筆の出やすさを見比べて選びましょう。打順や先発ローテーションは「⚙ 編成」から変えられます。' },
];

function done(): boolean {
  if (shownThisSession) return true;
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}
function markDone(): void {
  shownThisSession = true;
  try { localStorage.setItem(KEY, '1'); } catch { /* 保存できない環境 */ }
}
export function resetGuide(): void {
  shownThisSession = false;
  try { localStorage.removeItem(KEY); } catch { /* 保存できない環境 */ }
}

/** 試合画面を描いたあとに呼ぶ。未表示ならガイドを重ねて出す */
export function maybeShowGuide(): void {
  if (done() || document.querySelector('.guide-overlay')) return;
  let step = 0;
  const overlay = document.createElement('div');
  overlay.className = 'guide-overlay';
  const draw = () => {
    const s = STEPS[step];
    overlay.innerHTML = `<div class="guide-box">
      <div class="guide-step">${step + 1} / ${STEPS.length}</div>
      <h2>${s.title}</h2>
      <p>${s.body}</p>
      <div class="row" style="justify-content:flex-end;">
        <button class="btn secondary small" data-guide="skip">スキップ</button>
        <button class="btn small" data-guide="next">${step === STEPS.length - 1 ? 'はじめる' : '次へ'}</button>
      </div>
    </div>`;
    const target = step === 0 ? document.querySelector('.pencil-bars') : step === 1 ? document.querySelector('#rollBtn') : document.querySelector('.field-row');
    document.querySelectorAll('.guide-focus').forEach((el) => el.classList.remove('guide-focus'));
    target?.classList.add('guide-focus');
    target?.scrollIntoView({ block: 'center' });
    overlay.querySelectorAll<HTMLElement>('[data-guide]').forEach((b) => {
      b.onclick = () => {
        if (b.dataset.guide === 'next' && step < STEPS.length - 1) { step++; draw(); return; }
        markDone();
        document.querySelectorAll('.guide-focus').forEach((el) => el.classList.remove('guide-focus'));
        overlay.remove();
      };
    });
  };
  document.body.appendChild(overlay);
  draw();
}
