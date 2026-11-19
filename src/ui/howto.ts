/* 「遊び方」タブ */
import { ABILITY_INFO, ABILITY_KEYS } from '../engine/data';
import { clearSeasonHistory } from '../engine/history';
import { clearSave } from '../engine/save';
import { hardResetLeague } from '../engine/season';
import { STORAGE_AVAILABLE } from '../engine/storage';
import { render } from './app';
import { $ } from './format';
import { openConfirmModal } from './modal';
import { clearHoldTimers } from './play';
import { UI, resetTransientUi } from './state';

export function renderHowTo(): string {
  return `
  <div class="card">
    <h2>遊び方・ルール</h2>
    <div class="rules">
      2本の六角鉛筆を転がして1打席ずつ結果を決める、簡易サイコロ野球です（出目の確率は現実のプロ野球に近づくよう調整済み）。<br>
      <b>1本目</b>：ヒット・四球・フライ（3塁走者いれば犠飛）・ゴロ（走者いればゲッツー）・三振・<b>おっと</b><br>
      <b>2本目</b>（おっと時のみ）：2ベース・HR・三振・フライ（同上）・ゴロ（同上）<br>
      主なハウスルール：ゲッツーは"詰まっている走者"の先頭が封殺（1,2塁→2塁走者、1,3塁→1塁走者、満塁→3塁走者）／
      犠飛は3塁走者のみ生還／2ベース・3塁打は走者全員生還／四球は押し出しのみ進塁／その打席がイニング最終アウトの場合は得点なし。<br>
      さらに、単打が俊足で二塁打に化けたり、二塁打が俊足で三塁打になったり、逆にパワー不足で本塁打がフェンス直撃の二塁打止まりになることもあります。ゴロ・フライのアウトは、まれに相手の失策（E）で出塁に変わることもあります。<br>
      各打者には <b>パワー・ミート・走力</b>（A〜Gの7段階）に加え、一部の選手だけが持つ<b>特殊能力</b>があります（下の一覧）。能力が結果を覆すと画面に演出が出ます。守備位置と打順・能力の傾向は連動して自動的に組まれます（1〜2番は一番打者向き・堅実、3〜5番は勝負強い・一発長打・満塁男が出やすいなど）。<br>
      各球団には<b>監督</b>がいて、采配タイプに応じてチーム全体に効果がかかります（「選手名鑑」で確認できます）。Bクラスが3年続くか任期が切れると交代します。<br>
      144試合のレギュラーシーズン終了後、上位3チームでクライマックスシリーズ→日本シリーズに進出します（4位以下は来年に期待）。同率首位の順位決定はイーストリーグとウエストリーグで規則が異なります（詳しくは「順位表」タブに記載）。シーズン終了後に「新しいシーズンを始める」を押すと、そのシーズンの成績が「球団史」タブに記録されます（ポストシーズン未完了の場合は自動で最後まで消化されます）。
    </div>
    <details class="howto" style="margin-top:10px;">
      <summary>特殊能力の一覧</summary>
      <div class="rules">${ABILITY_KEYS.map((k) => `<b>${ABILITY_INFO[k].label}</b>：${ABILITY_INFO[k].desc}`).join('<br>')}</div>
    </details>
    </div>
  </div>
  <div class="card">
    <h2>セーブデータ</h2>
    <div class="muted" style="margin-bottom:8px;">${STORAGE_AVAILABLE
      ? '試合の進み具合・選手・球団史は、この端末のブラウザに自動で保存されます。途中で閉じても、次に開けば続きから遊べます。'
      : 'このブラウザでは保存が使えないため、タブを閉じると最初からになります（プライベートブラウズでは保存できないことがあります）。'}</div>
    <button class="btn secondary small" id="resetAllBtn">すべて消して最初から始める</button>
  </div>`;
}

export function wireHowToEvents(): void {
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
