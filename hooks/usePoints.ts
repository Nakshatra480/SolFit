import { getApp } from '@react-native-firebase/app';
import { addDoc, collection, doc, FirebaseFirestoreTypes, getFirestore, increment, limit, onSnapshot, orderBy, query, setDoc } from '@react-native-firebase/firestore';
import { useEffect, useState } from 'react';
import { snapshotHandlers } from '../lib/snapshot';

export interface PointsHistory {
  id?: string;
  reason: string;
  amount: number;
  createdAt: number;
}

export function usePoints(address: string | null) {
  const [totalPoints, setTotalPoints] = useState(0);
  const [history, setHistory] = useState<PointsHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) {
      setTotalPoints(0);
      setHistory([]);
      setLoading(false);
      return;
    }

    const db = getFirestore(getApp());

    // Real-time listener for total points
    const userRef = doc(db, 'users', address);
    const unsubUser = onSnapshot(userRef, ...snapshotHandlers<FirebaseFirestoreTypes.DocumentSnapshot>(
      'points total',
      snap => {
        setTotalPoints(snap.data()?.points ?? 0);
        setLoading(false);
      },
      () => setLoading(false),
    ));

    // Real-time listener for points history
    const historyRef = collection(db, 'users', address, 'points_history');
    const q = query(historyRef, orderBy('createdAt', 'desc'), limit(20));
    const unsubHistory = onSnapshot(q, ...snapshotHandlers<FirebaseFirestoreTypes.QuerySnapshot>(
      'points history',
      snapshot => setHistory(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PointsHistory))),
    ));

    return () => {
      unsubUser();
      unsubHistory();
    };
  }, [address]);

  const addPoints = async (amount: number, reason: string) => {
    if (!address) return;
    const db = getFirestore(getApp());

    // Use increment to avoid race conditions
    const userRef = doc(db, 'users', address);
    await setDoc(userRef, { points: increment(amount), updatedAt: Date.now() }, { merge: true });

    // Add history entry
    const historyRef = collection(db, 'users', address, 'points_history');
    await addDoc(historyRef, { reason, amount, createdAt: Date.now() });
  };

  return { totalPoints, history, loading, addPoints };
}
