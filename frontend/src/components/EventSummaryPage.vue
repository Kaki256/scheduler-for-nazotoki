<template>
  <div class="container p-3"> <!-- container padding reduced -->
    <header class="mb-4"> <!-- header margin-bottom reduced -->
      <div class="flex items-center justify-between">
        <h1 class="text-3xl font-bold text-indigo-700">{{ eventName }} - 出欠状況</h1>
        <button @click="goBack" class="button-secondary">一覧に戻る</button>
      </div>
      <p v-if="eventStartDate && eventEndDate" class="text-gray-600 text-sm mt-1">
        対象期間: {{ formatDateForDisplay(eventStartDate) }} 〜 {{ formatDateForDisplay(eventEndDate) }}
      </p>
      <p v-if="maxParticipants" class="text-gray-600 text-sm mt-1">
        1チームの最大人数: {{ maxParticipants }}人
      </p>
    </header>

    <div v-if="loadingInitialData" class="loading-message">
      <svg class="loading-spinner-large" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <p class="text-lg text-gray-600 mt-4">集計情報を読み込み中...</p>
    </div>

    <div v-if="errorMessage" class="error-container">
      <p>{{ errorMessage }}</p>
    </div>

    <div v-if="!loadingInitialData && !errorMessage && groupedTimeSlotsForTable.length > 0" class="summary-table-container mb-6"> <!-- margin-bottom reduced -->
      <h2 class="text-xl font-semibold text-gray-800 mb-2">出欠詳細</h2> <!-- margin-bottom reduced -->

      <!-- <div class="my-3 flex justify-start">
        <button @click="toggleShowFullDatesInSummary" class="button-secondary">
          {{ showFullDatesInSummary ? '完売日程を隠す' : '完売日程も表示する' }}
        </button>
      </div> -->

      <table class="summary-table">
        <thead>
          <tr>
            <th class="sticky-col header-dategroup">日付/時間</th>
            <th v-for="user in allUsers" :key="user" class="header-username">{{ user }}</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="group in groupedTimeSlotsForTable" :key="group.dateKey">
            <tr v-for="(slot, slotIdx) in group.slots" :key="group.dateKey + '-' + slot.fullUtc">
              <td class="sticky-col cell-dategroup">
                <div>
                  <span class="date-label">{{ group.dateLabel }}</span>
                  <span class="slot-time">{{ slot.timeLabel }}</span>
                </div>
              </td>
              <td v-for="user in allUsers" :key="user + '-' + slot.fullUtc"
                  :class="['cell-status', getStatusClass(userSelectionsMap[user]?.[slot.fullUtc])]"
                  :title="getStatusTitle(userSelectionsMap[user]?.[slot.fullUtc], user, slot.fullUtc)">
                {{ getStatusDisplay(userSelectionsMap[user]?.[slot.fullUtc]) }}
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div> <!-- End of summary-table-container -->

    <!-- Fixed Teams Configuration Section Wrapper -->
    <div v-if="!loadingInitialData && !errorMessage && participatingUsers.length > 0" class="mb-6">
      <button @click="toggleFixedTeamsSection" class="button-secondary mb-2">
        {{ isFixedTeamsSectionVisible ? '固定チーム設定を隠す' : '固定チーム設定を表示' }}
      </button>

      <div v-if="isFixedTeamsSectionVisible" class="fixed-teams-configurator p-4 border rounded-lg shadow-md bg-gray-100">
        <h2 class="text-xl font-semibold text-gray-800 mb-3">固定チーム設定</h2>
        <div class="flex flex-col md:flex-row gap-4">
          <!-- Available Users for Dragging -->
          <div class="w-full md:w-1/3">
            <h3 class="text-lg font-medium text-gray-700 mb-2">参加者リスト (ドラッグ可能)</h3>
            <div
              class="user-list bg-white p-2 rounded border min-h-[100px]"
              @dragover.prevent
              @drop="handleDropOnUserList"
            >
              <div
                v-for="user in availableUsersForDnd"
                :key="user"
                :draggable="true"
                @dragstart="handleDragStart($event, user, null, -1)"
                class="p-1 my-1 bg-gray-200 text-gray-800 rounded cursor-grab hover:bg-gray-300"
              >
                {{ user }}
              </div>
              <p v-if="availableUsersForDnd.length === 0 && fixedTeams.flat().length === participatingUsers.length" class="text-sm text-gray-500">全参加者が固定チームに割当済です。</p>
              <p v-else-if="availableUsersForDnd.length === 0" class="text-sm text-gray-500">固定できる参加者がいません。</p>
            </div>
          </div>

          <!-- Fixed Teams Area -->
          <div class="w-full md:w-2/3">
            <h3 class="text-lg font-medium text-gray-700 mb-2">固定チーム</h3>
            <div
              class="fixed-teams-area bg-white p-2 rounded border min-h-[100px]"
              @dragover.prevent
              @drop="handleDropOnFixedTeamsArea($event, -1)"
            >
              <div
                v-for="(team, teamIndex) in fixedTeams"
                :key="teamIndex"
                class="fixed-team-card bg-indigo-50 p-2 my-2 rounded border border-indigo-200"
                @dragover.prevent
                @drop="handleDropOnFixedTeamsArea($event, teamIndex)"
              >
                <div class="flex justify-between items-center mb-1">
                  <h4 class="font-semibold text-gray-800">チーム {{ teamIndex + 1 }}</h4> <!-- Changed text-indigo-600 to text-gray-800 -->
                  <button @click="removeFixedTeam(teamIndex)" class="text-red-500 hover:text-red-700 text-xs">チーム削除</button>
                </div>
                <div class="min-h-[30px] border border-dashed border-indigo-300 p-1 rounded drop-target-inner-team">
                  <span
                    v-for="(member, memberIndex) in team"
                    :key="member"
                    :draggable="true"
                    @dragstart="handleDragStart($event, member, teamIndex, memberIndex)"
                    class="inline-block p-1 mx-0.5 my-0.5 bg-indigo-200 text-gray-800 rounded cursor-grab text-sm hover:bg-indigo-300"
                  > <!-- Changed text-indigo-800 to text-gray-800 -->
                    {{ member }}
                  </span>
                  <p v-if="team.length === 0" class="text-xs text-gray-400 italic">このチームにメンバーをドラッグ</p>
                </div>
              </div>
              <p v-if="fixedTeams.length === 0" class="text-sm text-gray-500 p-2">ここに右のリストからユーザーをドラッグして新しい固定チームを作成するか、下のボタンで空のチームを追加できます。</p>
              <button @click="addNewFixedTeam" class="mt-2 button-small-secondary">新しい空の固定チームを追加</button>
            </div>
          </div>
        </div>
        <button @click="applyFixedTeamsAndRegenerate" class="mt-4 button-primary">固定チームを適用して再計算</button>
        <button @click="resetFixedTeams" class="mt-4 ml-2 button-secondary">固定をリセット</button>
      </div>
    </div>


    <!-- New Team Combinations Section -->
    <div v-if="loadingTeamCombinations" class="loading-message">
      <svg class="loading-spinner-large" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <p class="text-lg text-gray-600 mt-4">チーム編成案を生成中...</p>
    </div>
    
    <div v-if="!loadingTeamCombinations && !errorMessage && sortedTeamCombinations.length > 0" class="team-combinations-container mt-6"> <!-- margin-top reduced -->
      <h2 class="text-xl font-semibold text-gray-800 mb-2">チーム編成案 (総合スコア順)</h2> <!-- margin-bottom reduced -->
      
      <!-- Pagination Controls -->
      <div v-if="totalPages > 1" class="pagination-controls my-3 flex justify-center items-center space-x-2">
        <button @click="prevPage" :disabled="currentPage === 1" class="button-pagination" :class="{'opacity-50 cursor-not-allowed': currentPage === 1}">前へ</button>
        
        <template v-for="(page, index) in displayedPageNumbers" :key="index">
          <span v-if="page === '...'" class="pagination-ellipsis">...</span>
          <button v-else @click="goToPage(page)"
                  :class="['button-page-number', {'bg-indigo-500 text-white': currentPage === page}]">
            {{ page }}
          </button>
        </template>
        
        <button @click="nextPage" :disabled="currentPage === totalPages" class="button-pagination" :class="{'opacity-50 cursor-not-allowed': currentPage === totalPages}">次へ</button>
      </div>
      <p class="text-sm text-gray-600 text-center mb-3" v-if="sortedTeamCombinations.length > 0">
        全 {{ sortedTeamCombinations.length }} 件中 {{ (currentPage - 1) * itemsPerPage + 1 }} - {{ Math.min(currentPage * itemsPerPage, sortedTeamCombinations.length) }} 件表示
      </p>

      <div v-for="(combination, comboIndex) in paginatedTeamCombinations" :key="comboIndex" class="team-combination-card mb-4 p-3 border rounded-lg shadow-md bg-gray-50"> <!-- padding and margin reduced -->
        <h3 class="text-lg font-bold text-gray-900 mb-2"> <!-- text-green-700 removed, text-gray-900 added, margin-bottom reduced -->
          編成案 {{ (currentPage - 1) * itemsPerPage + comboIndex + 1 }}
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"> <!-- gap reduced -->
          <div v-for="(team, teamIndex) in combination.structureDetails" :key="teamIndex" class="team-card bg-white p-2 rounded-lg shadow"> <!-- padding reduced -->
            <!-- <h4 class="font-semibold text-indigo-600">チーム {{ teamIndex + 1 }}</h4> -->
            <!-- <p class="text-sm text-gray-700 font-semibold">チームランク: {{ team.teamRankLevel }}</p> -->
            <!-- <p class=\"text-sm text-gray-700\">評価スコア: {{ team.scoreInBestSlot.toFixed(2) }}</p> -->
            <!-- <p class=\"text-sm text-gray-700\">メンバー ({{ team.members.length }}人):</p> -->
            <ul class="list-disc list-inside pl-3 text-sm text-gray-600 mt-1"> <!-- padding-left reduced, margin-top added -->
              <li v-for="member in team.members" :key="member" class="my-0.5">
                <span v-if="team.bestSlotsDetails.length > 0 && userSelectionsMap[member]"
                      :class="['ml-1 text-xs font-mono px-1 rounded', getStatusClass(userSelectionsMap[member]?.[team.bestSlotsDetails[0].utc])]" 
                      :title="`Status for ${team.bestSlotsDetails[0].dateLabel} ${team.bestSlotsDetails[0].timeLabel}`">
                  {{ getStatusDisplay(userSelectionsMap[member]?.[team.bestSlotsDetails[0].utc]) }}
                </span>
                <span v-else-if="team.bestSlotsDetails.length > 0" class="ml-1 text-xs text-gray-400 font-mono px-1 rounded status-unknown" :title="`Status for ${team.bestSlotsDetails[0].dateLabel} ${team.bestSlotsDetails[0].timeLabel}`">(-)</span>
                {{ member }}
              </li>
            </ul>
            <div v-if="team.bestSlotsDetails && team.bestSlotsDetails.length > 0">
              <p class="text-sm text-gray-700 font-semibold">最適日時:</p>
              <ul class="text-xs text-gray-600 list-none pl-1">
                <li v-for="(slotDetail, slotIdx) in team.bestSlotsDetails" :key="slotIdx" class="flex items-center">
                  <span v-if="vacancyStatusMap[slotDetail.utc]" :class="getVacancyStatusClass(vacancyStatusMap[slotDetail.utc])" class="mr-1 vacancy-indicator w-6 text-center inline-block">
                    {{ formatVacancyStatus(vacancyStatusMap[slotDetail.utc]) }}
                  </span>
                  <span v-else class="mr-1 vacancy-indicator text-gray-400 w-6 text-center inline-block">?</span>
                  <span>{{ slotDetail.dateLabel }} {{ slotDetail.timeLabel }}</span>
                </li>
              </ul>
            </div>
            <p v-else class="text-sm text-gray-500">最適な日時スロットが見つかりません (スコア: 0.00)</p>
          </div>
        </div>
      </div>
    </div>
    <div v-if="!loadingInitialData && !loadingTeamCombinations && !errorMessage && sortedTeamCombinations.length === 0 && participatingUsers.length > 0 && allEventTimeSlotsUTC.length > 0 && maxParticipants > 0" class="no-data-message">
      <p class="text-gray-600">条件に合うチーム編成案を生成できませんでした。参加人数やチームの最大人数設定を確認してください。</p>
    </div>
    <div v-if="!loadingInitialData && !errorMessage && participatingUsers.length === 0 && allEventTimeSlotsUTC.length > 0" class="no-data-message">
      <p class="text-gray-600">参加可能なユーザーが見つかりませんでした。</p>
    </div>
    <div v-if="!loadingInitialData && !errorMessage && groupedTimeSlotsForTable.length === 0 && allEventTimeSlotsUTC.length > 0" class="no-data-message">
      <p class="text-gray-600">集計可能な日時スロットがありませんでした。イベント期間を確認してください。</p>
    </div>
    <div v-if="!loadingInitialData && !errorMessage && allEventTimeSlotsUTC.length === 0" class="no-data-message">
      <p class="text-gray-600">このイベントには利用可能な日時スロットが見つかりませんでした。</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';

const props = defineProps({
  orgSlug: { type: String, required: true },
  eventSlug: { type: String, required: true }
});

const route = useRoute();
const router = useRouter();

const loadingInitialData = ref(false);
const loadingTeamCombinations = ref(false);
const errorMessage = ref('');
const eventName = ref('');
const eventStartDate = ref('');
const eventEndDate = ref('');
const maxParticipants = ref(null); // maxParticipants を追加
const allEventTimeSlotsUTC = ref([]);
const allUsers = ref([]);
const userSelectionsMap = ref({}); // { username: { utcDateTime: status } }

const vacancyStatusMap = ref({}); // { [utcSlot]: vacancyType }
const eventLocationUid = ref(''); // イベントの場所UID

const internalSortedTeamCombinations = ref([]);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

// State for showing/hiding full dates in summary table
const showFullDatesInSummary = ref(false);

// User Ranks (Internal)
const userRanks = {
  "Pina641": 1,
  "Kasyu": 1,
  "soramea": 1,
  "inutamago_dogegg": 2,
  "Dye": 2,
  "soucy": 2,
  "test": 1,
  "test2": 2,
  "test7": 2,
  "test8": 2,
};

function getUserRankScore(username) {
  const rank = userRanks[username];
  if (rank === 1) return 3;
  if (rank === 2) return 1;
  return 0;
}

// Pagination state
const currentPage = ref(1);
const itemsPerPage = ref(10);

// Toggle function for showing/hiding full dates in summary table
function toggleShowFullDatesInSummary() {
  showFullDatesInSummary.value = !showFullDatesInSummary.value;
}

// Fixed teams state
const fixedTeams = ref([]);
const draggedItem = ref({ user: null, fromTeamIndex: null, memberIndexInTeam: null });
const isFixedTeamsSectionVisible = ref(true); // Default to visible

const availableUsersForDnd = computed(() => {
  const fixedMembers = new Set(fixedTeams.value.flat());
  return participatingUsers.value.filter(user => !fixedMembers.has(user));
});

// Toggle function for fixed teams section visibility
function toggleFixedTeamsSection() {
  isFixedTeamsSectionVisible.value = !isFixedTeamsSectionVisible.value;
}

// Helper function to generate all possible team structures
function generateAllPossibleTeamStructures(users, numTeams, maxTeamSize, fixedTeams = null) {
  const resultStructuresSet = new Set();
  const n = users.length;

  if (n === 0 || numTeams === 0) {
    return [];
  }
  if (n > numTeams * maxTeamSize || n < numTeams) {
    // Potentially impossible to form teams, though backtracking will naturally find no solutions.
  }

  const teams = Array(numTeams).fill(null).map(() => []);

  function normalizeTeamStructure(structure) {
    const normalizedStruct = structure.map(team => [...team].sort());
    normalizedStruct.sort((teamA, teamB) => JSON.stringify(teamA).localeCompare(JSON.stringify(teamB)));
    return normalizedStruct;
  }

  function backtrack(userIndex) {
    if (userIndex === n) {
      if (teams.some(team => team.length === 0)) {
        return;
      }

      if (fixedTeams && fixedTeams.length > 0) {
        for (const ft of fixedTeams) {
          if (ft.length === 0) continue; // Skip empty fixed teams if they somehow occur
          let ftSatisfied = false;
          for (const team of teams) {
            if (ft.every(member => team.includes(member))) {
              // Ensure this team doesn't also contain members of *another* fixed team
              // unless those members are also part of ft (for overlapping fixed teams, though UI might not support this).
              // For simplicity with current UI (distinct fixed teams):
              // Check if this team contains members of other fixed teams that are not in ft.
              let containsOtherExclusiveFixedMembers = false;
              if (fixedTeams.length > 1) {
                for (const otherFt of fixedTeams) {
                  if (otherFt === ft) continue;
                  if (otherFt.some(otherMember => team.includes(otherMember) && !ft.includes(otherMember))) {
                    containsOtherExclusiveFixedMembers = true;
                    break;
                  }
                }
              }
              if (!containsOtherExclusiveFixedMembers) {
                ftSatisfied = true;
                break;
              }
            }
          }
          if (!ftSatisfied) return; // This fixed team's constraint is not met
        }
      }

      const currentPartition = teams.map(team => [...team]);
      const normalized = normalizeTeamStructure(currentPartition);
      resultStructuresSet.add(JSON.stringify(normalized));
      return;
    }

    const currentUser = users[userIndex];
    const userFixedTeam = fixedTeams ? fixedTeams.find(ft => ft.includes(currentUser)) : null;

    if (userFixedTeam) {
      // Current user IS part of a fixed team. Try to place them according to fixed team rules.
      for (let i = 0; i < numTeams; i++) {
        if (teams[i].length < maxTeamSize) {
          // Condition 1: Team 'i' must be suitable for this userFixedTeam.
          // Suitable if: a) teams[i] is empty, OR b) teams[i] already contains other members of userFixedTeam.
          const alreadyHasMyTeammates = teams[i].some(member => userFixedTeam.includes(member) && member !== currentUser);
          const canJoinBasedOnMyTeam = teams[i].length === 0 || alreadyHasMyTeammates;

          if (canJoinBasedOnMyTeam) {
            // Condition 2: Team 'i' must NOT contain members of any OTHER fixed team.
            let violatesOtherFixedTeam = false;
            if (fixedTeams) {
              for (const otherFt of fixedTeams) {
                if (otherFt === userFixedTeam) continue;
                if (otherFt.some(otherMember => teams[i].includes(otherMember))) {
                  violatesOtherFixedTeam = true;
                  break;
                }
              }
            }

            if (!violatesOtherFixedTeam) {
              teams[i].push(currentUser);
              backtrack(userIndex + 1);
              teams[i].pop();
            }
          }
        }
      }
      // If a fixed user cannot be placed according to these rules in any team,
      // this path is invalid for this user. So, we return.
      // This ensures fixed users strictly adhere to their placement constraints.
      return;
    } else {
      // Current user is NOT part of any fixed team.
      for (let i = 0; i < numTeams; i++) {
        if (teams[i].length < maxTeamSize) {
          // This non-fixed user cannot join a team that currently holds an INCOMPLETE fixed group.
          let violatesIncompleteFixedGroup = false;
          if (fixedTeams && teams[i].length > 0) {
            for (const ft of fixedTeams) {
              if (ft.length === 0) continue;
              const membersOfFtInTeamI = ft.filter(m => teams[i].includes(m));
              // If team 'i' has some members of 'ft', but not all of them, it's an incomplete fixed group.
              if (membersOfFtInTeamI.length > 0 && membersOfFtInTeamI.length < ft.length) {
                violatesIncompleteFixedGroup = true;
                break;
              }
            }
          }

          if (!violatesIncompleteFixedGroup) {
            teams[i].push(currentUser);
            backtrack(userIndex + 1);
            teams[i].pop();
          }
        }
        // Optimization: if the current team is empty, the next user can either start
        // a new team (if this one remains empty) or join this one. No need to try
        // placing this user in subsequent empty teams as they would be symmetrical.
        if (teams[i].length === 0) {
          break;
        }
      }
    }
  }

  backtrack(0);
  return Array.from(resultStructuresSet).map(s => JSON.parse(s));
}

const participatingUsers = computed(() => {
  const userSet = new Set();
  if (allUsers.value && userSelectionsMap.value) {
    allUsers.value.forEach(user => {
      const selections = userSelectionsMap.value[user];
      if (selections) {
        for (const slotUtc in selections) {
          const status = selections[slotUtc];
          if (status === 'available' || status === 'going' || status === 'maybe') {
            userSet.add(user);
            break; // User is participating, no need to check other slots for this user
          }
        }
      }
    });
  }
  return Array.from(userSet);
});

const displayedPageNumbers = computed(() => {
  const total = totalPages.value;
  const current = currentPage.value;
  const delta = 2; // Number of pages to show before and after current page
  const range = [];
  const rangeWithDots = [];
  let l;

  range.push(1);
  for (let i = current - delta; i <= current + delta; i++) {
    if (i < total && i > 1) {
      range.push(i);
    }
  }
  range.push(total);

  for (let i of range) {
    if (l) {
      if (i - l === 2) {
        rangeWithDots.push(l + 1);
      } else if (i - l !== 1) {
        rangeWithDots.push('...');
      }
    }
    rangeWithDots.push(i);
    l = i;
  }
  // Remove duplicates if totalPages is small
  return [...new Set(rangeWithDots)];
});

const eventUrl = computed(() => {
  if (route.params.eventUrlProp) {
    return decodeURIComponent(route.params.eventUrlProp);
  }
  return '';
});

const groupedTimeSlotsForTable = computed(() => {
  const groups = {};
  const slotsToProcess = showFullDatesInSummary.value
    ? allEventTimeSlotsUTC.value
    : allEventTimeSlotsUTC.value.filter(utc => vacancyStatusMap.value[utc] !== 'FULL');

  slotsToProcess.forEach(utc => {
    const dateObj = new Date(utc);
    
    // JSTでの日付文字列をキーとする (例: 2025-07-15)
    const jstDateKey = dateObj.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Tokyo' }).replace(/\//g, '-');
    // 表示用の日付ラベル (例: 7月15日 (火))
    const dateLabel = dateObj.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short', timeZone: 'Asia/Tokyo' });
    // 表示用の時間ラベル (例: 09:00)
    const timeLabel = dateObj.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' });

    if (!groups[jstDateKey]) {
      groups[jstDateKey] = { dateLabel: dateLabel, slots: [] };
    }
    groups[jstDateKey].slots.push({
      timeLabel: timeLabel,
      fullUtc: utc
    });
  });

  // Mapを日付順にソートして配列に変換
  return Object.entries(groups)
    .sort(([dateKeyA], [dateKeyB]) => new Date(dateKeyA) - new Date(dateKeyB))
    .map(([dateKey, value]) => ({
      dateKey: dateKey,
      dateLabel: value.dateLabel,
      slots: value.slots.sort((s1, s2) => s1.timeLabel.localeCompare(s2.timeLabel)) // 各日付内のスロットも時間でソート
    }));
});

async function fetchSummaryData() {
  if (!props.orgSlug || !props.eventSlug) {
    errorMessage.value = 'Organization slug or Event slug is missing.';
    return;
  }
  loadingInitialData.value = true;
  errorMessage.value = '';

  // Reconstruct the event URL from slugs, ensuring it ends with a slash
  const eventUrl = `https://escape.id/org/${props.orgSlug}/event/${props.eventSlug}/`;
  console.log('[EventSummaryPage] Reconstructed event URL for fetching summary:', eventUrl);

  try {
    const encodedEventUrl = encodeURIComponent(eventUrl);
    const response = await axios.get(`${API_BASE_URL}/events/${encodedEventUrl}/summary`);
    const data = response.data;

    eventName.value = data.eventName || '';
    eventStartDate.value = data.eventStartDate || '';
    eventEndDate.value = data.eventEndDate || '';
    maxParticipants.value = data.maxParticipants || null;
    allEventTimeSlotsUTC.value = (data.allEventTimeSlotsUTC || []).sort();
    allUsers.value = data.allUsers || [];
    userSelectionsMap.value = data.userSelectionsMap || {};

    if (data.locationUid) {
        eventLocationUid.value = data.locationUid;
    } else {
        // Fallback:別途イベント詳細を取得してlocationUidを得る
        try {
            console.log(`[SummaryPage] Fetching event details for locationUid for: ${eventUrl}`);
            const eventDetailsResponse = await fetch(`${API_BASE_URL}/events/${encodeURIComponent(eventUrl)}`);
            if (eventDetailsResponse.ok) {
                const details = await eventDetailsResponse.json();
                if (details.locationUid) {
                    eventLocationUid.value = details.locationUid;
                    console.log('[SummaryPage] Fetched locationUid:', eventLocationUid.value);
                } else {
                    console.warn('[SummaryPage] locationUid not found in event details.');
                    // エラーメッセージに追記する形に変更
                    const msg = 'イベントの場所情報(locationUid)の取得に失敗しました。売れ行き状況を表示できません。';
                    errorMessage.value = errorMessage.value ? `${errorMessage.value}\\n${msg}` : msg;
                }
            } else {
                 console.warn('[SummaryPage] Failed to fetch event details for locationUid.');
                 const msg = 'イベント詳細の取得に失敗し、売れ行き状況を表示できません。';
                 errorMessage.value = errorMessage.value ? `${errorMessage.value}\\n${msg}` : msg;
            }
        } catch (err) {
            console.error('[SummaryPage] Error fetching event details for locationUid:', err);
            const msg = 'イベント詳細の取得中にエラーが発生し、売れ行き状況を表示できません。';
            errorMessage.value = errorMessage.value ? `${errorMessage.value}\\n${msg}` : msg;
        }
    }

    if (eventLocationUid.value && allEventTimeSlotsUTC.value.length > 0 && eventStartDate.value && eventEndDate.value) {
        await fetchVacancyData(); // 売れ行き情報を取得
    }

    currentPage.value = 1;
    loadingInitialData.value = false;
    console.log('loadingInitialData set to false');

    // UI更新を確実にするためにsetTimeoutを使用
    setTimeout(() => {
      generateAndSortTeamCombinations(null); // Pass null for initial load
    }, 0);

  } catch (err) {
    console.error('Failed to fetch event summary:', err);
    errorMessage.value = `集計データの読み込みに失敗しました: ${err.message}`;
    loadingInitialData.value = false;
    loadingTeamCombinations.value = false;
  }
}

async function fetchVacancyData() {
  if (!props.orgSlug || !props.eventSlug || !eventStartDate.value || !eventEndDate.value || !eventLocationUid.value) {
    console.warn('Cannot fetch vacancy data, missing params.', 
      { orgSlug: props.orgSlug, eventSlug: props.eventSlug, start: eventStartDate.value, end: eventEndDate.value, uid: eventLocationUid.value });
    return;
  }
  const reconstructedEventUrl = `https://escape.id/org/${props.orgSlug}/event/${props.eventSlug}/`;
  console.log('Fetching vacancy data for:', reconstructedEventUrl, eventStartDate.value, eventEndDate.value, eventLocationUid.value);
  try {
    const scheduleResponse = await axios.post(`${API_BASE_URL}/get-schedule`, {
      event_url: reconstructedEventUrl,
      date_from: eventStartDate.value,
      date_to: eventEndDate.value,
      location_uid: eventLocationUid.value
    });
    
    console.log('[ScheduleFetch] Raw API Response:', JSON.parse(JSON.stringify(scheduleResponse.data))); // ★ 詳細なレスポンス全体ログ
    console.log('[ScheduleFetch] Raw API Response Data:', JSON.parse(JSON.stringify(scheduleResponse.data))); // ★ レスポンスデータログ

    console.log('Vacancy data response status:', scheduleResponse);
    const scheduleData = await scheduleResponse.data;
    const newVacancyMap = {};
    if (scheduleData && scheduleData.dates && Array.isArray(scheduleData.dates)) {
      scheduleData.dates.forEach(dateEntry => {
        if (dateEntry && dateEntry.slots && Array.isArray(dateEntry.slots)) {
          dateEntry.slots.forEach(slot => {
            if (slot.startAt && slot.vacancyType) {
              newVacancyMap[slot.startAt] = slot.vacancyType; // Fixed this line
            }
          });
        }
      });
    }
    vacancyStatusMap.value = newVacancyMap;
    console.log('Vacancy status map updated:', JSON.parse(JSON.stringify(vacancyStatusMap.value)));
  } catch (err) {
    console.error('Failed to fetch vacancy data:', err);
    // ユーザー向けエラーメッセージは fetchSummary 側で既に出ている可能性があるので、ここではコンソールエラーに留めるか、軽微な通知に。
    // errorMessage.value = (errorMessage.value ? errorMessage.value + '\\n' : '') + 'スロットの売れ行き状況の取得に失敗しました。';
  }
}

function getVacancyScore(vacancyType) {
  const scores = {
    'MANY': 5,
    'FEW': 1,
    'FULL': 0,
    'NOT_IN_SALES_PERIOD': 0,
  };
  return scores[vacancyType] || 0;
}

function generateAndSortTeamCombinations(fixedTeamsFromUI = null) {
  if (!allEventTimeSlotsUTC.value || allEventTimeSlotsUTC.value.length === 0 || 
      !maxParticipants.value || maxParticipants.value <= 0 || 
      participatingUsers.value.length === 0) {
    internalSortedTeamCombinations.value = [];
    loadingTeamCombinations.value = false;
    return;
  }

  const users = participatingUsers.value;
  const numTeamsToForm = Math.ceil(users.length / maxParticipants.value);

  if (numTeamsToForm === 0) {
    internalSortedTeamCombinations.value = [];
    loadingTeamCombinations.value = false;
    return;
  }
  
  let validFixedTeams = null;
  if (fixedTeamsFromUI) {
    validFixedTeams = fixedTeamsFromUI.map(team => 
      team.filter(member => users.includes(member))
    ).filter(team => team.length > 0);
    if (validFixedTeams.length === 0) validFixedTeams = null;
  }

  const allPossibleStructures = generateAllPossibleTeamStructures(users, numTeamsToForm, maxParticipants.value, validFixedTeams);
  if (allPossibleStructures.length === 0) {
    internalSortedTeamCombinations.value = [];
    loadingTeamCombinations.value = false;
    return;
  }

  const evaluatedCombinations = allPossibleStructures.map(structure => {
    let minBestSlotScoreForStructure = Infinity;
    let minTeamRankLevelForStructure = Infinity;
    let minOverallVacancyScoreForStructure = Infinity; // 編成案の総合的な空き状況スコア（最小値を採用）

    const teamsInStructureDetails = structure.map(teamMembers => {
      let teamRankLevel = 0;
      teamMembers.forEach(member => {
        teamRankLevel += getUserRankScore(member);
      });
      minTeamRankLevelForStructure = Math.min(minTeamRankLevelForStructure, teamRankLevel);

      if (teamMembers.length === 0) { 
        return {
          members: [],
          bestSlotsDetails: [],
          scoreInBestSlot: 0,
          teamRankLevel: 0,
          maxVacancyScoreInBestSlots: 0, // 空チームの空きスコア
        };
      }

      let maxScoreForTeam = -1;
      let bestSlotsForTeamUtc = []; 

      allEventTimeSlotsUTC.value.forEach(slotUtc => {
        let goingCount = 0;
        let maybeCount = 0;
        teamMembers.forEach(member => {
          const status = userSelectionsMap.value[member]?.[slotUtc];
          if (status === 'available' || status === 'going') {
            goingCount++;
          } else if (status === 'maybe') {
            maybeCount++;
          }
        });

        const currentSlotScore = teamMembers.length > 0 ? (5 * goingCount + 2 * maybeCount - 100 * (teamMembers.length - goingCount - maybeCount)) / teamMembers.length : 0;

        if (currentSlotScore > maxScoreForTeam) {
          maxScoreForTeam = currentSlotScore;
          bestSlotsForTeamUtc = [slotUtc];
        } else if (currentSlotScore === maxScoreForTeam && maxScoreForTeam !== -1) { // Ensure not adding to empty if initial was -1
          bestSlotsForTeamUtc.push(slotUtc);
        }
      });
      
      const bestSlotsDetails = bestSlotsForTeamUtc.map(slotUtc => {
        const d = new Date(slotUtc);
        return {
          utc: slotUtc,
          dateLabel: d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short', timeZone: 'Asia/Tokyo' }),
          timeLabel: d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }),
        };
      });
      
      const actualScoreInBestSlot = maxScoreForTeam === -1 ? 0 : maxScoreForTeam;
      minBestSlotScoreForStructure = Math.min(minBestSlotScoreForStructure, actualScoreInBestSlot);

      let maxVacancyScoreForTeamInBestSlots = 0;
      if (bestSlotsDetails.length > 0) {
        bestSlotsDetails.forEach(slotDetail => {
          const vacancyType = vacancyStatusMap.value[slotDetail.utc];
          const score = getVacancyScore(vacancyType);
          if (score > maxVacancyScoreForTeamInBestSlots) {
            maxVacancyScoreForTeamInBestSlots = score;
          }
        });
      }

      return {
        members: teamMembers,
        bestSlotsDetails: bestSlotsDetails,
        scoreInBestSlot: actualScoreInBestSlot,
        teamRankLevel: teamRankLevel,
        maxVacancyScoreInBestSlots: maxVacancyScoreForTeamInBestSlots, 
      };
    });

    // 編成案の総合的な空き状況スコアを計算
    // (編成内の各チームの「最適日時における最高の空き状況スコア」のうち、最も低いものを採用)
    if (teamsInStructureDetails.length > 0) {
        minOverallVacancyScoreForStructure = Math.min(...teamsInStructureDetails.map(t => t.maxVacancyScoreInBestSlots));
    } else {
        minOverallVacancyScoreForStructure = 0; 
    }

    return {
      structureDetails: teamsInStructureDetails,
      overallSlotScore: minBestSlotScoreForStructure === Infinity ? 0 : minBestSlotScoreForStructure,
      minTeamRankLevel: minTeamRankLevelForStructure === Infinity ? 0 : minTeamRankLevelForStructure,
      overallVacancyScore: minOverallVacancyScoreForStructure === Infinity ? 0 : minOverallVacancyScoreForStructure, 
    };
  });

  evaluatedCombinations.sort((a, b) => {
    // 1. Overall Vacancy Score (descending) - 残り枚数が多い順
    if (b.overallVacancyScore !== a.overallVacancyScore) {
      return b.overallVacancyScore - a.overallVacancyScore;
    }
    // 2. Minimum Team Rank Level (descending)
    if (b.minTeamRankLevel !== a.minTeamRankLevel) {
      return b.minTeamRankLevel - a.minTeamRankLevel;
    }
    // 3. Overall Slot Score (descending)
    return b.overallSlotScore - a.overallSlotScore;
  });
  
  internalSortedTeamCombinations.value = evaluatedCombinations;
  loadingTeamCombinations.value = false;
}

const sortedTeamCombinations = computed(() => {
  return internalSortedTeamCombinations.value;
});

const totalPages = computed(() => {
  if (!sortedTeamCombinations.value) return 0;
  return Math.ceil(sortedTeamCombinations.value.length / itemsPerPage.value);
});

const paginatedTeamCombinations = computed(() => {
  if (!sortedTeamCombinations.value || sortedTeamCombinations.value.length === 0) {
    return [];
  }
  const start = (currentPage.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return sortedTeamCombinations.value.slice(start, end);
});

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
  }
}

function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--;
  }
}

function goToPage(pageNumber) {
  if (pageNumber >= 1 && pageNumber <= totalPages.value) {
    currentPage.value = pageNumber;
  }
}


// REMOVE or REPLACE the old teamAssignments computed property:
// const teamAssignments = computed(() => { ... }); // This entire block should be removed.

function formatDateForDisplay(dateString) { // Renamed from formatDate
  if (!dateString) return '';
  // JSTで表示 (YYYY年M月D日)
  const date = new Date(dateString + 'T00:00:00Z'); // UTCとして解釈
  return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Tokyo' });
}

function formatDateTimeForHeader(utcDateTimeString) { // This is used in getStatusTitle, keep as is or make specific if needed
  if (!utcDateTimeString) return '';
  const date = new Date(utcDateTimeString);
  // JSTで表示 (M月D日 HH:mm)
  return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' });
}

function getStatusDisplay(status) {
  switch (status) {
    case 'available':
    case 'going':
      return '〇';
    case 'maybe':
      return '△';
    case 'unavailable':
    case 'not_going':
      return '×';
    default:
      return '-';
  }
}

function getStatusClass(status) {
  switch (status) {
    case 'available':
    case 'going':
      return 'status-available';
    case 'maybe':
      return 'status-maybe';
    case 'unavailable':
    case 'not_going':
      return 'status-unavailable';
    default:
      return 'status-unknown';
  }
}

function getStatusTitle(status, username, slotUtc) {
    const userDisplay = username || '不明なユーザー';
    const timeDisplay = formatDateTimeForHeader(slotUtc); // Uses the original full UTC string for detailed title
    const statusText = getStatusDisplay(status);
    return `${userDisplay} - ${timeDisplay}: ${statusText}`;
}

function formatVacancyStatus(vacancyType) {
  const statusMap = {
    'MANY': '〇',
    'FEW': '△',
    'FULL': '×',
    'NOT_IN_SALES_PERIOD': '-',
  };
  return statusMap[vacancyType] !== undefined ? statusMap[vacancyType] : '？'; // Default to '？' if type is unexpected
}

function getVacancyStatusClass(vacancyType) {
  switch (vacancyType) {
    case 'MANY': 
      return 'text-green-600 font-bold';
    case 'FEW': 
      return 'text-yellow-600 font-bold';
    case 'FULL': 
      return 'text-red-600 font-bold';
    case 'NOT_IN_SALES_PERIOD': 
      return 'text-blue-500 font-bold';
    default:
      return 'text-gray-400';
  }
}

function goBack() {
  router.push({ name: 'EventList' });
}

function handleDragStart(event, user, fromTeamIdx, memberIdx) {
  draggedItem.value = { user, fromTeamIndex: fromTeamIdx, memberIndexInTeam: memberIdx };
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', user); // Necessary for Firefox
  }
}

function handleDropOnFixedTeamsArea(event, targetTeamIndex) {
  event.preventDefault();
  const { user, fromTeamIndex, memberIndexInTeam } = draggedItem.value;
  if (!user) return;

  // Prevent adding to a team if it would exceed maxParticipants
  if (targetTeamIndex !== -1 && fixedTeams.value[targetTeamIndex] && fixedTeams.value[targetTeamIndex].length >= maxParticipants.value && !fixedTeams.value[targetTeamIndex].includes(user) ) {
    console.warn(`Cannot add to team ${targetTeamIndex + 1}, it would exceed max participants.`);
    // Optionally, provide user feedback here
    draggedItem.value = { user: null, fromTeamIndex: null, memberIndexInTeam: null };
    return;
  }

  // 1. Remove from original position
  if (fromTeamIndex !== null && typeof fromTeamIndex === 'number' && fixedTeams.value[fromTeamIndex]) { // Dragged from an existing fixed team
    fixedTeams.value[fromTeamIndex].splice(memberIndexInTeam, 1);
  }

  // 2. Add to new position
  if (targetTeamIndex === -1) { // Dropped on the general "Fixed Teams Area" to create a new team
    if (maxParticipants.value === null || 1 <= maxParticipants.value) {
        fixedTeams.value.push([user]);
    } else {
        console.warn(`Cannot create new team with user ${user}, it would exceed max participants if maxParticipants is 0.`);
        if (fromTeamIndex !== null && typeof fromTeamIndex === 'number' && fixedTeams.value[fromTeamIndex]) { // Re-add if removed
             if (!fixedTeams.value[fromTeamIndex]) fixedTeams.value[fromTeamIndex] = [];
             fixedTeams.value[fromTeamIndex].splice(memberIndexInTeam, 0, user);
        }
        draggedItem.value = { user: null, fromTeamIndex: null, memberIndexInTeam: null };
        return;
    }
  } else { // Dropped on an existing team card (targetTeamIndex)
    if (!fixedTeams.value[targetTeamIndex]) {
      fixedTeams.value[targetTeamIndex] = [];
    }
    if (!fixedTeams.value[targetTeamIndex].includes(user)) { // Prevent duplicates in the same team
        fixedTeams.value[targetTeamIndex].push(user);
    }
  }

  // 3. Cleanup: Remove empty teams that might have resulted from moving a member.
  fixedTeams.value = fixedTeams.value.filter(team => team.length > 0);

  draggedItem.value = { user: null, fromTeamIndex: null, memberIndexInTeam: null };
}

function handleDropOnUserList(event) {
  event.preventDefault();
  const { user, fromTeamIndex, memberIndexInTeam } = draggedItem.value;
  if (!user || fromTeamIndex === null || typeof fromTeamIndex !== 'number') return; // Only handle drops from a fixed team

  if(fixedTeams.value[fromTeamIndex]){
    fixedTeams.value[fromTeamIndex].splice(memberIndexInTeam, 1);
    if (fixedTeams.value[fromTeamIndex].length === 0) {
      fixedTeams.value.splice(fromTeamIndex, 1);
    }
  }
  draggedItem.value = { user: null, fromTeamIndex: null, memberIndexInTeam: null };
}

function addNewFixedTeam() {
  if (maxParticipants.value === null || 0 < maxParticipants.value) { 
    fixedTeams.value.push([]);
  } else {
    console.warn("Cannot add new empty team if maxParticipants is 0.");
  }
}

function removeFixedTeam(teamIndex) {
    fixedTeams.value.splice(teamIndex, 1);
}

function applyFixedTeamsAndRegenerate() {
  loadingTeamCombinations.value = true;
  internalSortedTeamCombinations.value = []; 
  currentPage.value = 1; 
  
  setTimeout(() => {
    const teamsToUse = fixedTeams.value.filter(team => team.length > 0);
    generateAndSortTeamCombinations(teamsToUse.length > 0 ? teamsToUse : null);
  }, 0);
}

function resetFixedTeams() {
    fixedTeams.value = [];
    applyFixedTeamsAndRegenerate();
}

onMounted(() => {
  fetchSummaryData();
});
</script>

<style scoped>
/* General Styles */
.container {
  max-width: 100%;
  padding-left: 0.75rem; /* p-3 equivalent for horizontal */
  padding-right: 0.75rem; /* p-3 equivalent for horizontal */
  padding-top: 0.75rem; /* p-3 equivalent for vertical */
  padding-bottom: 0.75rem; /* p-3 equivalent for vertical */
  margin-left: auto;
  margin-right: auto;
  background-color: #f9fafb; /* bg-gray-50 */
  min-height: 100vh;
}

.button-secondary {
  background-color: #e5e7eb;
  color: #374151;
  font-weight: 500;
  padding: 0.4rem 0.8rem; /* Reduced padding */
  border-radius: 0.5rem;
  box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05);
  transition: all 0.15s ease-in-out;
  font-size: 0.8rem; /* Reduced font size */
}
.button-secondary:hover {
  background-color: #d1d5db;
  box-shadow: 0 2px 4px -1px rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.06); /* Adjusted shadow */
}
.button-secondary:focus {
  outline: 2px solid transparent;
  outline-offset: 2px;
  box-shadow: 0 0 0 2px #9ca3af;
}

.loading-message, .no-data-message {
  text-align: center;
  padding-top: 2rem; /* Reduced padding */
  padding-bottom: 2rem; /* Reduced padding */
}
.loading-spinner-large {
  animation: spin 1s linear infinite;
  margin-left: auto;
  margin-right: auto;
  height: 2.25rem; /* Reduced size */
  width: 2.25rem; /* Reduced size */
  color: #4f46e5;
}
.error-container {
  margin-bottom: 1rem; /* Reduced margin */
  padding: 0.75rem; /* Reduced padding */
  background-color: #fee2e2;
  border: 1px solid #f87171;
  color: #b91c1c;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.06);
}

.summary-table-container {
  overflow-x: auto;
  background-color: white;
  border-radius: 0.375rem; /* Reduced border-radius */
  box-shadow: 0 2px 4px -1px rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.05); /* Adjusted shadow */
}

.summary-table {
  width: 100%;
  min-width: 500px; /* Reduced min-width */
  border-collapse: collapse;
  table-layout: fixed;
}

.summary-table th, .summary-table td {
  border: 1px solid #e5e7eb;
  padding: 0.4rem; /* Reduced padding */
  text-align: center;
  font-size: 0.8rem; /* Reduced font size */
}
.header-dategroup, .header-username {
  min-width: 100px; /* Reduced min-width */
  max-width: 160px; /* Reduced max-width */
  white-space: normal;
  vertical-align: middle;
  color: #1f2937;
  background: #f3f4f6;
}
.cell-dategroup {
  font-weight: 500;
  color: #1f2937;
  background: #f9fafb;
  text-align: left;
  min-width: 100px; /* Reduced min-width */
}
.date-label {
  font-size: 0.9em;
  font-weight: bold;
  margin-right: 0.4em; /* Reduced margin */
}
.slot-time {
  color: #4b5563;
  font-size: 0.85em; /* Adjusted font size */
}
.cell-status {
  min-width: 50px; /* Reduced min-width */
}

.sticky-col {
  position: sticky;
  left: 0;
  background-color: #f9fafb;
  width: 100px; /* Reduced width */
  overflow: hidden;
  text-overflow: ellipsis;
}
.summary-table thead .sticky-col {
  background-color: #f3f4f6;
  z-index: 30;
}
.summary-table tbody .sticky-col {
  background-color: white;
  z-index: 20;
}

.slot-entry {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.15rem 0.25rem; /* Reduced padding */
  margin-bottom: 0.05rem; /* Reduced margin */
  border-radius: 0.2rem; /* Reduced border-radius */
  font-size: 0.75rem; /* Reduced font size */
  text-align: left;
}
.slot-entry:last-child {
  margin-bottom: 0;
}

.slot-time { /* This is duplicated, ensure correct one is used or merge */
  margin-right: 0.4em;
  color: #4b5563;
  white-space: nowrap;
}

.slot-status {
  font-weight: bold;
  white-space: nowrap;
}

.status-available {
  background-color: #d1fae5;
  color: #065f46;
}
.status-maybe {
  background-color: #fef3c7;
  color: #92400e;
}
.status-unavailable {
  background-color: #fee2e2;
  color: #991b1b;
}
.status-unknown {
  background-color: #f3f4f6;
  color: #4b5563;
}

.team-assignments-container { /* This class seems unused now */
  margin-top: 1.5rem; /* Reduced margin */
}

.team-card {
  background-color: #ffffff;
  padding: 0.75rem; 
  border-radius: 0.375rem; 
  box-shadow: 0 1px 2px 0 rgba(0,0,0,0.08), 0 1px 1px 0 rgba(0,0,0,0.05); 
}

.button-pagination {
  background-color: #e5e7eb; /* bg-gray-200 */
  color: #374151; /* text-gray-700 */
  font-weight: 500; /* font-medium */
  padding: 0.3rem 0.6rem; /* Reduced padding */
  border-radius: 0.375rem; /* rounded-md */
  font-size: 0.75rem; /* Reduced font-size */
  transition: background-color 0.15s ease-in-out;
}
.button-pagination:hover:not(:disabled) {
  background-color: #d1d5db; /* hover:bg-gray-300 */
}
.button-pagination:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.button-page-number {
  background-color: #e5e7eb; /* bg-gray-200 */
  color: #374151; /* text-gray-700 */
  font-weight: 500; /* font-medium */
  padding: 0.3rem 0.6rem; /* Reduced padding */
  border-radius: 0.375rem; /* rounded-md */
  font-size: 0.75rem; /* Reduced font-size */
  min-width: 2rem; /* Ensure consistent width */
  text-align: center;
  transition: background-color 0.15s ease-in-out, color 0.15s ease-in-out;
}
.button-page-number:hover:not(.bg-indigo-500) {
  background-color: #d1d5db; /* hover:bg-gray-300 */
}
.button-page-number.bg-indigo-500 { /* Active page style */
  background-color: #6366f1; /* bg-indigo-500 */
  color: white;
}

.pagination-ellipsis {
  color: #6b7280; /* text-gray-500 */
  padding: 0.3rem 0.4rem; /* Reduced padding */
  font-size: 0.75rem; /* Reduced font-size */
  align-self: center;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.pagination-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 1rem;
}

.pagination-controls button {
  flex-shrink: 0;
}

.vacancy-indicator {
  /* 必要に応じてスタイル調整 */
  display: inline-block;
  /* width: 1.5em; ensure consistent width if needed */
  text-align: center;
}

.user-list .cursor-grab,
.fixed-team-card .cursor-grab {
  padding: 4px 8px;
  margin: 2px;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}

.user-list .cursor-grab:hover,
.fixed-team-card .cursor-grab:hover {
  background-color: #cbd5e1; /* Tailwind gray-300 */
}
.fixed-team-card .bg-indigo-200:hover {
  background-color: #a5b4fc; /* Tailwind indigo-300 */
}

.fixed-team-card {
  background-color: #e0e7ff; /* Tailwind indigo-100 */
  border: 1px solid #c7d2fe; /* Tailwind indigo-200 */
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  border-radius: 0.375rem;
}
.drop-target-inner-team { /* Use this class for the inner droppable area of a team card */
  min-height: 30px;
  padding: 0.25rem;
  border: 1px dashed #a5b4fc; /* Tailwind indigo-300 */
  border-radius: 0.25rem;
}
.button-small-secondary {
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
  /* Assuming button-secondary styles are defined elsewhere, or define basic ones here */
  background-color: #e5e7eb; /* gray-200 */
  color: #374151; /* gray-700 */
  padding: 0.5rem 1rem;
  border-radius: 0.375rem; /* rounded-md */
  border: 1px solid #d1d5db; /* gray-300 */
  font-weight: 500; /* medium */
  transition: background-color 0.2s;
}
.button-secondary:hover {
  background-color: #d1d5db; /* gray-300 */
}

.button-small-secondary {
  background-color: #f3f4f6; /* gray-100 */
  color: #4b5563; /* gray-600 */
  padding: 0.25rem 0.75rem; /* Smaller padding */
  border-radius: 0.375rem; /* rounded-md */
  border: 1px solid #e5e7eb; /* gray-200 */
  font-size: 0.875rem; /* text-sm */
  font-weight: 500; /* medium */
  transition: background-color 0.2s;
}
.button-small-secondary:hover {
  background-color: #e5e7eb; /* gray-200 */
}

.button-pagination {
  padding: 0.375rem 0.75rem;
  border: 1px solid #d1d5db; /* gray-300 */
  background-color: white;
  color: #374151; /* gray-700 */
  border-radius: 0.375rem;
  transition: background-color 0.2s, color 0.2s;
}
.button-pagination:hover:not(:disabled) {
  background-color: #f3f4f6; /* gray-100 */
}
/* :disabled state is handled by Tailwind classes in the template */

.button-page-number {
  padding: 0.375rem 0.75rem;
  border: 1px solid #d1d5db; /* gray-300 */
  background-color: white;
  color: #374151; /* gray-700 */
  border-radius: 0.375rem;
  transition: background-color 0.2s, color 0.2s;
  min-width: 2.25rem; /* Ensure consistent width for numbers */
  text-align: center;
}
.button-page-number:hover {
  background-color: #f3f4f6; /* gray-100 */
}
.button-page-number.bg-indigo-500 { /* Active page style */
  border-color: #6366f1; /* indigo-500 */
}

.pagination-ellipsis {
  padding: 0.375rem 0.5rem;
  color: #6b7280; /* gray-500 */
}

/* Ensure sticky column headers have a background to cover content when scrolling */
.sticky-col.header-dategroup, .sticky-col.header-username {
  background-color: #f9fafb; /* Tailwind's gray-50 */
  z-index: 20; /* Ensure header is above content */
}
.sticky-col.cell-dategroup {
  background-color: #ffffff; /* White background for data cells */
  z-index: 10; /* Ensure data cell is above other cells but below header */
}

</style>
