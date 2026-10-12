import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useState } from 'react'
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { HowToSheet } from '../../components/HowToSheet'
import { LockedInCard } from '../../components/lockedIn/LockedInCard'
import { SignInGate } from '../../components/SignInGate'
import { useWallet } from '../../context/WalletContext'
import { homeQuests, useChallenges, type ChallengeView } from '../../hooks/useChallenges'
import { useGoals } from '../../hooks/useGoals'
import { useUserStats } from '../../hooks/useUserStats'
import { dataLoading } from '../../lib/dataLoading'
import { NM_COLORS } from '../../constants/naturalMotion'
import { SolFitMark } from '../../components/StartupLoader'

const C = NM_COLORS

// Live calendar day index (instance.progress.dayIndex only updates on workout save).
function liveDayIndex(q: ChallengeView): number {
  if (!q.instance) return 0
  return Math.max(
    1,
    Math.min(
      q.catalog.requirementDays,
      Math.floor((Date.now() - q.instance.startedAt) / 86400000) + 1,
    ),
  )
}

export default function HomeScreen() {
  const { publicKey, shortAddress, connecting, restoring, connect, disconnect, dataAddress } = useWallet()
  const address = dataAddress
  const { goals, loading: goalsLoading } = useGoals(address)
  const { stats, loading: statsLoading } = useUserStats(address)
  const { challenges, loading: questsLoading } = useChallenges(address)
  const [showDisconnect, setShowDisconnect] = useState(false)
  const [showHowTo, setShowHowTo] = useState(false)
  // A connected wallet's numbers stay blank until its data is read, before sign-in too, so no 0 shows
  // that isn't the wallet's own (lib/dataLoading.ts).
  const blank = dataLoading(!!publicKey, dataAddress, goalsLoading || statsLoading)

  const dailyGoal = goals.find(g => g.id === 'daily')
  const weeklyGoal = goals.find(g => g.id === 'weekly')
  const reps = dailyGoal?.current ?? 0
  const target = dailyGoal?.total ?? 30
  const progress = blank ? 0 : Math.min(reps / target, 1)

  const formattedPoints = stats.points.toLocaleString()
  const streakDisplay = stats.currentStreak > 0 ? `${stats.currentStreak}d` : '0d'

  // Quests: only runs still going or waiting for their claim (this version starts no new ones), and
  // nothing until the wallet's runs are read.
  const quests = homeQuests(challenges)
  const showQuests = !dataLoading(!!publicKey, dataAddress, questsLoading) && quests.length > 0

  return (
    // Top edge only: the tab bar already covers the bottom inset, and SafeAreaView measures insets
    // against the whole window, so a bottom edge here left a blank band above the tab bar.
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <View style={s.brand}>
            <SolFitMark size={38} />
            <Text style={s.logo}>
              <Text style={{ color: C.dark }}>Sol</Text>
              <Text style={{ color: C.amber2 }}>Fit</Text>
            </Text>
          </View>
          {publicKey ? (
            <TouchableOpacity style={s.walletConnected} onPress={() => setShowDisconnect(true)}>
              <View style={s.walletDot}/>
              <Text style={s.walletConnectedText}>{shortAddress}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.walletBtn} onPress={connect} disabled={connecting || restoring}>
              <Text style={s.walletBtnText}>{connecting || restoring ? 'Connecting...' : 'Connect Wallet'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Greeting */}
        <View style={s.greet}>
          <Text style={s.greetTitle}>Ready to move?</Text>
        </View>

        <SignInGate />

        {/* Today's Progress Card */}
        <View style={s.progressCard}>
          <View style={s.progressTop}>
            <View>
              <Text style={s.progressLabel}>{"TODAY'S PROGRESS"}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
                <Text style={s.progressReps}>{blank ? ' ' : reps}</Text>
                <Text style={s.progressTarget}>/ {target}</Text>
              </View>
            </View>
          </View>
          <View style={s.progressBar}>
            <View style={[s.progressFill, { width: `${progress * 100}%` }]}/>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={s.progressNote}>
              {blank ? ' ' : reps >= target ? '🎉 Goal reached!' : `${target - reps} more to hit your goal`}
            </Text>
            <Text style={s.progressPct}>{blank ? ' ' : `${Math.round(progress * 100)}%`}</Text>
          </View>
        </View>

        {/* Stats Row */}
        <View style={s.statsRow}>
          {[
            { label: 'Points',    value: blank ? ' ' : formattedPoints, accent: true  },
            { label: 'Streak',    value: blank ? ' ' : streakDisplay,   accent: false },
            { label: 'This Week', value: blank ? ' ' : weeklyGoal ? `${weeklyGoal.current}/7` : '0/7', accent: false },
          ].map(stat => (
            <View key={stat.label} style={[s.statCard, stat.accent && s.statCardAccent]}>
              <Text style={[s.statValue, stat.accent && s.statValueAccent]}>{stat.value}</Text>
              <Text style={[s.statLabel, stat.accent && s.statLabelAccent]}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Start Button: today's count is already in the progress card above */}
        <TouchableOpacity style={s.startBtn} onPress={() => router.push('/workout')} activeOpacity={0.85}>
          <View style={{ flex: 1 }}>
            <Text style={s.startBtnExercise}>SQUAT</Text>
            <Text style={s.startBtnTitle}>Start Session</Text>
          </View>
          <View style={s.startBtnIcon}>
            <Text style={{ color: '#fff', fontSize: 18 }}>{'\u25B6\uFE0E'}</Text>
          </View>
        </TouchableOpacity>

        {/* How to squat: a pill like the wallet address one in the header */}
        <View style={s.howToRow}>
          <TouchableOpacity style={s.howToPill} onPress={() => setShowHowTo(true)} activeOpacity={0.85}>
            <Text style={s.howToPillIcon}>ⓘ</Text>
            <Text style={s.howToPillText}>How to Squat</Text>
          </TouchableOpacity>
        </View>

        <LockedInCard />

        {/* Quests */}
        {showQuests && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Quests</Text>

            {quests.map((q, idx) => {
              const stackStyle = { marginBottom: idx < quests.length - 1 ? 12 : 0 }
              if (q.instance!.status === 'completed') {
                return (
                  <TouchableOpacity
                    key={q.catalog.id}
                    style={[s.questClaim, stackStyle]}
                    onPress={() => router.push(`/challenges/${q.catalog.id}`)}
                    activeOpacity={0.85}
                  >
                    <View style={s.questHeadRow}>
                      <Text style={s.questClaimLabel}>✓ READY TO CLAIM</Text>
                      <View style={s.questClaimBadge}>
                        <Text style={s.questClaimBadgeText}>🛡 {q.catalog.nft.romanNumeral}</Text>
                      </View>
                    </View>
                    <Text style={s.questClaimTitle}>{q.catalog.name}</Text>
                    <Text style={s.questClaimReward}>
                      Reward: +{q.catalog.bonusPoints} points
                    </Text>
                    <View style={s.questClaimCta}>
                      <Text style={s.questClaimCtaText}>Claim Reward →</Text>
                    </View>
                  </TouchableOpacity>
                )
              }
              const dayIdx = liveDayIndex(q)
              return (
                <TouchableOpacity
                  key={q.catalog.id}
                  style={stackStyle}
                  onPress={() => router.push(`/challenges/${q.catalog.id}`)}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={[q.catalog.nft.gradientFrom, q.catalog.nft.gradientTo] as [string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.questCard}
                  >
                    <View style={s.questCardTopRow}>
                      <Text style={s.questCardRarity}>{q.catalog.rarity.toUpperCase()}</Text>
                      <View style={s.questCardBadge}>
                        <Text style={s.questCardBadgeText}>🛡 {q.catalog.nft.romanNumeral}</Text>
                      </View>
                    </View>
                    <Text style={s.questCardTitle}>{q.catalog.name}</Text>
                    <View style={s.questCardProgressBar}>
                      <View style={[s.questCardProgressFill, { width: `${q.progressPct * 100}%` }]} />
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={s.questCardProgressNote}>
                        Day {dayIdx} of {q.catalog.requirementDays}
                        {q.daysRemaining !== null ? ` · ${q.daysRemaining} days left` : ''}
                      </Text>
                      <Text style={s.questCardProgressPct}>{Math.round(q.progressPct * 100)}%</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              )
            })}
          </View>
        )}

        <View style={{ height: 12 }}/>
      </ScrollView>

      <HowToSheet visible={showHowTo} onClose={() => setShowHowTo(false)} />

      {/* Disconnect Modal */}
      <Modal visible={showDisconnect} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalDot}/>
            <Text style={s.modalTitle}>Disconnect Wallet?</Text>
            <Text style={s.modalAddr}>{shortAddress}</Text>
            <Text style={s.modalDesc}>Disconnecting your wallet will disable points earning and on-chain achievement records.</Text>
            <TouchableOpacity style={s.modalDisconnect} onPress={() => { disconnect(); setShowDisconnect(false) }}>
              <Text style={s.modalDisconnectText}>Disconnect</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.modalCancel} onPress={() => setShowDisconnect(false)}>
              <Text style={s.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1, paddingHorizontal: 20 },

  header:             { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, paddingBottom: 11 },
  brand:              { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo:               { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  walletBtn:          { backgroundColor: C.dark, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100 },
  walletBtnText:      { color: '#fff', fontSize: 12, fontWeight: '700' },
  walletConnected:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.dark, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100 },
  walletDot:          { width: 7, height: 7, borderRadius: 4, backgroundColor: C.amber3 },
  walletConnectedText:{ color: '#fff', fontSize: 12, fontWeight: '700' },

  // Header bottom padding (11) is the whole gap between the logo row and the title.
  greet:      { paddingBottom: 16 },
  greetTitle: { fontSize: 26, color: C.text, fontWeight: '800', letterSpacing: -0.8 },

  progressCard:     { backgroundColor: C.card, borderRadius: 20, padding: 22, marginBottom: 14, borderWidth: 1, borderColor: C.line },
  progressTop:      { marginBottom: 16 },
  progressLabel:    { fontSize: 12, color: C.sub, letterSpacing: 1.2, marginBottom: 6, fontWeight: '600' },
  progressReps:     { fontSize: 52, color: C.text, fontWeight: '900', lineHeight: 56 },
  progressTarget:   { fontSize: 15, color: C.sub, marginBottom: 8, fontWeight: '500' },
  progressBar:      { height: 8, backgroundColor: C.bg2, borderRadius: 100, marginBottom: 10, overflow: 'hidden' },
  progressFill:     { height: 8, backgroundColor: C.amber2, borderRadius: 100 },
  progressNote:     { fontSize: 12, color: C.sub },
  progressPct:      { fontSize: 12, fontWeight: '700', color: C.amber2 },

  statsRow:        { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard:        { flex: 1, backgroundColor: C.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: C.line },
  statCardAccent:  { backgroundColor: C.amberBg, borderColor: C.amberBg },
  statValue:       { fontSize: 20, fontWeight: '800', color: C.text, marginBottom: 4 },
  statValueAccent: { color: C.amber },
  statLabel:       { fontSize: 11, color: C.muted, letterSpacing: 0.5, textTransform: 'uppercase' },
  statLabelAccent: { color: C.amber },

  startBtn:         { backgroundColor: C.amber2, borderRadius: 18, padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, shadowColor: C.dark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 3 },
  startBtnExercise: { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: -0.5, marginBottom: 4 },
  startBtnTitle:    { fontSize: 16, fontWeight: '700', color: 'rgba(255,255,255,0.88)' },
  startBtnIcon:     { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  howToRow:         { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12 },
  howToPill:        { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.dark, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100 },
  howToPillIcon:    { color: C.amber3, fontSize: 13, fontWeight: '800' },
  howToPillText:    { color: '#fff', fontSize: 12, fontWeight: '700' },

  section:       { marginBottom: 24 },
  // Same as LockedInCard's sectionTitle, so "Locked In Challenge" and "Quests" match.
  sectionTitle:  { fontSize: 20, fontWeight: '900', color: C.text, marginBottom: 12 },

  questHeadRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },

  questCard:               { borderRadius: 18, padding: 16, overflow: 'hidden' },
  questCardTopRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  questCardRarity:         { fontSize: 9, color: 'rgba(255,255,255,0.85)', letterSpacing: 1.2, fontWeight: '700' },
  questCardBadge:          { backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 },
  questCardBadgeText:      { fontSize: 10, color: '#fff', fontWeight: '700' },
  questCardTitle:          { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: -0.3, marginBottom: 14 },
  questCardProgressBar:    { height: 5, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 100, marginBottom: 8, overflow: 'hidden' },
  questCardProgressFill:   { height: 5, backgroundColor: '#fff', borderRadius: 100 },
  questCardProgressNote:   { fontSize: 10, color: 'rgba(255,255,255,0.75)' },
  questCardProgressPct:    { fontSize: 10, fontWeight: '700', color: '#fff' },

  questClaim:          { backgroundColor: C.amber2, borderRadius: 18, padding: 18, shadowColor: C.amber, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 8 },
  questClaimLabel:     { fontSize: 9, color: 'rgba(255,255,255,0.75)', letterSpacing: 1.5, fontWeight: '700' },
  questClaimBadge:     { backgroundColor: C.dark, borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 },
  questClaimBadgeText: { fontSize: 10, color: '#fff', fontWeight: '700' },
  questClaimTitle:     { fontSize: 18, fontWeight: '900', color: '#fff', letterSpacing: -0.4, marginBottom: 2 },
  questClaimReward:    { fontSize: 12, color: 'rgba(255,255,255,0.88)', marginBottom: 14, fontWeight: '600' },
  questClaimCta:       { backgroundColor: C.dark, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  questClaimCtaText:   { color: '#fff', fontSize: 14, fontWeight: '800' },

  modalOverlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox:            { backgroundColor: C.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, paddingBottom: 40, alignItems: 'center' },
  modalDot:            { width: 36, height: 4, backgroundColor: C.line, borderRadius: 100, marginBottom: 24 },
  modalTitle:          { fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 6 },
  modalAddr:           { fontSize: 12, color: C.muted, backgroundColor: C.bg2, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, marginBottom: 16, fontWeight: '600' },
  modalDesc:           { fontSize: 13, color: C.sub, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  modalDisconnect:     { width: '100%', backgroundColor: C.dark, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
  modalDisconnectText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  modalCancel:         { width: '100%', backgroundColor: C.bg2, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  modalCancelText:     { color: C.text, fontSize: 15, fontWeight: '600' },
})
