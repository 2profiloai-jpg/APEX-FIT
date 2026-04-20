
import React, { useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { UserProfile, WorkoutPlan } from '../types';
import { notificationService } from '../services/notificationService';
import { calculateBMR, calculateTDEE, calculateTargetKcal } from '../lib/calculations';

interface Props {
  profile: UserProfile | null;
}

export default function SmartNotificationManager({ profile }: Props) {
  useEffect(() => {
    if (!profile?.uid || !profile?.preferences?.pushNotifications) return;

    const checkAndNotify = async () => {
      // Avoid notifying multiple times in a short window (session-based)
      const lastNotify = sessionStorage.getItem('last-smart-notify');
      const now = Date.now();
      if (lastNotify && now - parseInt(lastNotify) < 1000 * 60 * 60) { // 1 hour cooldown
        return;
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const weekDays = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
      const todayDay = weekDays[new Date().getDay()];

      try {
        // 1. Check Workout
        const qWorkout = query(collection(db, 'users', profile.uid, 'plans'), where('dayOfWeek', '==', todayDay));
        const workoutSnap = await getDocs(qWorkout);
        
        if (!workoutSnap.empty) {
          const plan = workoutSnap.docs[0].data() as WorkoutPlan;
          notificationService.sendWorkoutReminder(plan.name);
        } else {
          // notificationService.sendRestDayReminder(); // Maybe too much noise?
        }

        // 2. Check Calories (if targets set)
        const nutritionRef = doc(db, `users/${profile.uid}/nutrition/${todayStr}`);
        const nutritionSnap = await getDocs(query(collection(db, `users/${profile.uid}/nutrition`), where('__name__', '==', todayStr)));
        
        if (!nutritionSnap.empty) {
          const data = nutritionSnap.docs[0].data();
          const meals = data.meals || {};
          let consumed = 0;
          Object.values(meals).forEach((mealArray: any) => {
            if (Array.isArray(mealArray)) {
              mealArray.forEach((item: any) => consumed += (item.kcal || 0));
            }
          });

          const weight = profile.weight || 0;
          const height = profile.height || 0;
          const age = profile.age || 0;
          const gender = profile.gender || 'male';
          const activityLevel = profile.activityLevel || 1.2;
          const goal = profile.goal || 'maintain';
          const bodyFat = profile.bodyFat;

          const bmr = weight && height && age ? calculateBMR(weight, height, age, gender, bodyFat) : 0;
          const tdee = calculateTDEE(bmr, activityLevel);
          const target = profile.customTargets?.kcal || calculateTargetKcal(tdee, goal);
          
          const remaining = Math.round(target - consumed);
          if (remaining > 500) { // Only notify if significant amount left
            notificationService.sendCalorieReminder(remaining);
          }
        }

        sessionStorage.setItem('last-smart-notify', now.toString());
      } catch (err) {
        console.error("Smart Notification Manager Error:", err);
      }
    };

    // Delay slightly to not overwhelm on boot
    const timer = setTimeout(checkAndNotify, 3000);
    return () => clearTimeout(timer);
  }, [profile]);

  return null; // Invisible component
}
