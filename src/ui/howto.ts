/* 「遊び方」タブ */
import { ABILITY_INFO, ABILITY_KEYS } from '../engine/data';
import { buildBackup, restoreBackup } from '../engine/backup';
import { clearSeasonHistory } from '../engine/history';
import { DB, teamById } from '../engine/state';
import { restartCurrentSeason } from '../engine/season';
import { FEEDBACK_URL } from '../config';
import { resetGuide } from './guide';
import { clearSave } from '../engine/save';
import { hardResetLeague } from '../engine/season';
import { STORAGE_AVAILABLE } from '../engine/storage';
import { render } from './app';
import { $ } from './format';
import { openConfirmModal } from './modal';
import { clearHoldTimers } from './play';
import { UI, resetTransientUi } from './state';
import { onPick, segTabs } from './components';

const section = (title: string, body: string, open = false) =>
  `<details class="howto" ${open ? 'open' : ''}><summary>${title}</summary><div class="rules">${body}</div></details>`;

function rulesHTML(): string {
  return `
  <div class="card intro">
    <b>鉛筆を転がして戦うプロ野球。</b>12球団・144試合のリーグで、マイチームを応援・采配しながら何十年分の歴史を作っていきます。
    <ol class="steps-list">
      <li>「試合」タブで <b>▶ 試合を観る</b>、鉛筆を転がして1打席ずつ進める（長押しで早送り）</li>
      <li>終盤の接戦では <b>勝負所カード</b> で代打や継投を決める</li>
      <li>シーズンが終わったら、ポストシーズン → 補強ガチャ → 次のシーズンへ</li>
    </ol>
  </div>
  ${section('✏️ 対戦表と鉛筆', `打席ごとに、打者と投手が鉛筆（1〜6の六角鉛筆）を1本ずつ同時に転がします。<br>
    <b>打者の数 ≧ 投手の数</b>（36通り中21通り）なら <b>打者の表</b>、<b>投手の数のほうが大きい</b>（15通り）なら <b>投手の表</b> のマスで結果が決まります。試合画面の6×6の表は、縦が打者の数・横が投手の数です。<br>
    打者の表はミート（ヒット・三振の少なさ）とパワー（2塁打・HR）で、投手の表は球威（三振）と制球（四球・HRの少なさ）で中身が変わります。<br>
    <b>2色のマス</b>は3本目の鉛筆の数で決めます（HRのように1マスより小さい確率を表すため）。鉛筆の後に結果が変わるのは、走力（単打→二塁打など）・特殊能力・失策のときだけです。`, true)}
  ${section('⚾ 投手', `投手は自分の表（15マス）を持っています。<b>球威</b>が高いと三振のマスが増え、<b>制球</b>が良いと四球とHRのマスが減ります。投げ続けて疲れると、凡打のマスがヒットや長打に書き換わっていきます。<br>
    各球団の投手は13人（先発6人のローテーション＋セットアッパー・抑え・中継ぎ）。継投は監督（AI）が行います。`)}
  ${section('🧢 監督とオーダー', `<b>勝負所カード</b>：7回以降・2点差以内で走者がいる場面になると試合が止まり、攻撃なら代打・盗塁・送りバント、守備なら継投・敬遠を選べます（1試合3回まで）。<br>
    <b>監督の方針</b>：打順の組み方（伝統型・2番最強型・機動力型など）と継投（先発完投型・標準・継投重視）は、各球団の監督の采配タイプで決まります。<br>
    <b>オーダー</b>（試合タブの「⚙ オーダー」）：入れ替えたい選手を2人タップすると、打順・スタメンと控え・投手の役割（先発◯番手・抑えなど）を入れ替えられます。自分で入れ替えた部分は、監督の自動の見直しが止まります。<br>
    レギュラーはときどき休み、控えが出場します。他球団も同じルールでAIが采配します。`)}
  ${section('📅 シーズンの流れ', `毎日12球団が1試合ずつ、144日で144試合。自分の試合が終わると、同じ日の他球団の試合も進みます。序盤のあとに交流戦があります。<br>
    上位3チームがプレーオフに進み、両リーグの王者が<b>ペンシルシリーズ</b>で対戦。シーズン後は補強ガチャ（各球団1名を新人と入れ替え）を経て次のシーズンへ。成績は「球団史」に残ります。<br>
    33歳を過ぎると年齢と衰えに応じて引退する選手が出て、新人（20〜25歳）が入ります。偉大な選手の背番号は永久欠番に。`)}
  ${section('📏 細かいルール', `走者一塁のゴロは併殺になりやすい（打者が俊足なら併殺崩れも）。単打で二塁走者が還れるか、二塁打で一塁走者が還れるかは走者の走力次第（2アウトなら還りやすい）。その打席がイニング3つ目のアウトなら得点は入りません。<br>
    延長は12回まで（同点なら引き分け）。規定打席はチーム試合数×3.1、規定投球回はチーム試合数×1回。<br>
    同率の順位は、イーストは勝利数→直接対決、ウエストは直接対決→勝利数の順で決めます。`)}
  ${section('⚡ 特殊能力の一覧', ABILITY_KEYS.map((k) => `<b>${ABILITY_INFO[k].label}</b>：${ABILITY_INFO[k].desc}`).join('<br>'))}`;
}

function settingsHTML(): string {
  const myTeamOpts = ['<option value="">（選ばない）</option>', ...DB.teams.map((t) => `<option value="${t.id}" ${UI.myTeamId === t.id ? 'selected' : ''}>${t.name}</option>`)].join('');
  return `
  <div class="card settings">
    <h2>遊び方の設定</h2>
    <label>マイチーム</label>
    <select id="myTeamSel">${myTeamOpts}</select>
    <label class="check"><input type="checkbox" id="cardsChk" ${DB.options?.decisionCards === false ? '' : 'checked'}> 終盤の接戦で「勝負所カード」を出す</label>
    <button class="link-btn" id="replayGuideBtn">操作ガイドをもう一度見る</button>
  </div>
  <div class="card settings">
    <h2>セーブデータ</h2>
    <div class="muted" style="font-size:11.5px;margin-bottom:8px;">${STORAGE_AVAILABLE
      ? 'この端末のブラウザに自動で保存されます。ブラウザのデータを消すとセーブも消えるので、ときどき書き出しておくと安心です（別の端末への引っ越しにも使えます）。'
      : 'このブラウザでは保存が使えないため、タブを閉じると最初からになります（プライベートブラウズなど）。'}</div>
    <div class="row">
      <button class="btn secondary small" id="exportBtn">📥 書き出す</button>
      <button class="btn secondary small" id="importBtn">📤 読み込む</button>
      <input type="file" id="importFile" accept="application/json,.json" style="display:none;">
    </div>
    <div class="danger-zone">
      <button class="link-btn danger" id="restartSeasonBtn">今シーズンを最初からやり直す</button>
      <button class="link-btn danger" id="resetAllBtn">すべて消して新しいリーグを作る</button>
    </div>
  </div>
  ${FEEDBACK_URL ? `<div class="card"><h2>ご意見・不具合の報告</h2><a class="btn small" href="${FEEDBACK_URL}" target="_blank" rel="noopener">意見を送る</a></div>` : ''}`;
}

export function renderHowTo(): string {
  const tab = UI.howtoTab === 'settings' ? 'settings' : 'rules';
  return segTabs('howtab', [{ key: 'rules', label: '遊び方' }, { key: 'settings', label: '設定・データ' }], tab)
    + (tab === 'settings' ? settingsHTML() : rulesHTML());
}

export function wireHowToEvents(): void {
  onPick('seg', 'howtab', (k) => { UI.howtoTab = k; render(); });
  const myTeamSel = $<HTMLSelectElement>('#myTeamSel');
  if (myTeamSel) myTeamSel.onchange = () => {
    UI.myTeamId = myTeamSel.value || null;
    UI.gachaSelecting = false; UI.gachaMySelection = null; UI.gachaResults = null;
    UI.flash = UI.myTeamId ? `マイチームを${teamById(UI.myTeamId)?.name}にしました。` : null;
    render();
  };
  const cardsChk = $<HTMLInputElement>('#cardsChk');
  if (cardsChk) cardsChk.onchange = () => { DB.options = { ...(DB.options ?? {}), decisionCards: cardsChk.checked }; render(); };
  const restart = $('#restartSeasonBtn');
  if (restart) restart.onclick = () => {
    openConfirmModal('今シーズンの成績・日程・ポストシーズンをリセットして、同じ選手で今シーズンを最初からやり直します（球団史には記録されません）。よろしいですか？', () => {
      clearHoldTimers();
      restartCurrentSeason();
      resetTransientUi();
      UI.tab = 'play';
      UI.flash = '今シーズンを最初からやり直します。';
      render();
    });
  };
  const exportBtn = $('#exportBtn');
  if (exportBtn) exportBtn.onclick = () => {
    void buildBackup({ myTeamId: UI.myTeamId, liveGame: UI.liveGame }).then((data) => {
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `pencil-baseball-backup-season${DB.currentSeasonNum}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    });
  };
  const fileInput = $<HTMLInputElement>('#importFile');
  const importBtn = $('#importBtn');
  if (importBtn && fileInput) {
    importBtn.onclick = () => fileInput.click();
    fileInput.onchange = () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      openConfirmModal(`「${file.name}」を読み込みます。いまのリーグ（進行中のシーズン・選手・球団史）は、このファイルの内容に置き換わります。よろしいですか？`, () => {
        void file.text().then(restoreBackup).then((ui) => {
          clearHoldTimers();
          resetTransientUi();
          UI.myTeamId = ui.myTeamId;
          UI.liveGame = ui.liveGame;
          UI.seasonHistory = null;
          UI.tab = 'play';
          UI.flash = 'バックアップを読み込みました。';
          render();
        }).catch((e: unknown) => {
          UI.flash = `読み込めませんでした：${e instanceof Error ? e.message : String(e)}`;
          UI.tab = 'play';
          render();
        });
      });
    };
  }
  const replay = $('#replayGuideBtn');
  if (replay) replay.onclick = () => { resetGuide(); UI.tab = 'play'; render(); };

  const btn = $('#resetAllBtn');
  if (!btn) return;
  btn.onclick = () => {
    openConfirmModal('進行中のシーズン・選手・球団史をすべて消して、新しいリーグを作り直します。元に戻すことはできません。よろしいですか？', () => {
      void Promise.all([clearSave(), clearSeasonHistory()]).then(() => {
        clearHoldTimers();
        hardResetLeague();
        resetTransientUi();
        UI.myTeamId = null;
        UI.seasonHistory = null;
        UI.tab = 'play';
        render();
      });
    });
  };
}
