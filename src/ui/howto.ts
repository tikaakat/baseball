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
      2本の六角鉛筆を転がして1打席ずつ結果を決める、簡易サイコロ野球です。成績が現実のプロ野球（NPB）に近くなるよう調整しています。<br>
      <b>鉛筆は打者ごとに違います。</b>打席に立った打者の能力から「その打者の鉛筆」が作られ、試合画面に各面の出やすさが表示されます。ミートが高いとヒットの面が大きく三振の面が小さく、パワーが高いと「おっと」とHRの面が大きくなります。<br>
      <b>1本目</b>：ヒット・四球・三振・凡打（フライ／ゴロ）・<b>おっと</b><br>
      <b>2本目</b>（おっと時のみ）：2ベース・HR・三振・凡打<br>
      鉛筆の後に結果が変わるのは、①走力（単打が二塁打、二塁打が三塁打に伸びる）②特殊能力 ③失策 のときだけです。<br>
      走者の動き：単打で二塁走者が還れるか、二塁打で一塁走者が還れるかは走者の走力次第（2アウトなら還りやすい）。走者一塁のゴロは併殺になりやすいが、打者が俊足なら併殺崩れも。三塁走者は外野フライでタッチアップ。その打席がイニング3つ目のアウトなら得点は入りません。延長は12回まで（それでも同点なら引き分け）。<br>
      <b>投手</b>は打者の鉛筆を書き換えます。球威が高いとヒットの面が小さく三振の面が大きく、制球が良いと四球とHRの面が小さくなります。投げ続けて疲れると、相手打者の鉛筆が良くなっていきます。各球団の投手は13人（先発6人のローテーション＋中継ぎ・セットアッパー・抑え）で、継投は監督（AI）が判断します。<br>
      <b>勝負所カード</b>：自分のチームの試合を観ているとき、7回以降の接戦（2点差以内）で走者がいる場面になると、試合が止まってカードが出ます。攻撃なら代打・盗塁・送りバント、守備なら投手交代・敬遠を、鉛筆の出やすさを見比べて決められます（1試合3回まで。「試合」タブで出さない設定にもできます）。それ以外の継投や代打は監督（AI）が行い、他球団も同じルールで采配します。<br>
      野手は13人（スタメン9人＋控え4人）。DH制なので投手は打席に立ちません。<br>
      各打者には <b>パワー・ミート・走力</b>（A〜Gの7段階）に加え、一部の選手だけが持つ<b>特殊能力</b>があります（下の一覧）。能力が結果を覆すと画面に演出が出ます。<br>
      各球団には<b>監督</b>がいて、采配タイプに応じて打者の鉛筆に効果がかかります（「名鑑」で確認できます）。Bクラスが3年続くか任期が切れると交代します。<br>
      <b>日程</b>：毎日12球団が1試合ずつ、144日で全144試合。自分の試合が終わると、同じ日の他球団の試合も自動で進みます。序盤の後に交流戦（各カード4試合）があります。<br>
      レギュラーシーズン終了後、上位3チームでプレーオフ→ペンシルシリーズ（両リーグの王者が対戦）。同率の順位決定はリーグで規則が異なります（「順位」タブに記載）。シーズン後に「新しいシーズンを始める」を押すと、成績が「球団史」に記録されます。<br>
      <b>オフシーズン</b>：33歳を過ぎると、年齢と衰えに応じて引退する選手が出て、新人（20〜25歳）が入ります。各球団1名を入れ替える補強ガチャもあります。
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
