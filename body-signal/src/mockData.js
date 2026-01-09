import { subDays, format } from 'date-fns';

// Helpers
const today = new Date();
const daysAgo = (n) => format(subDays(today, n), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");

// 1. Chronic Migraine (Variable, High Pain)
const migraineId = 'cond-1';
// 2. Lumbar Strain (Improving)
const lumbarId = 'cond-2';
// 3. Sleep Quality (New type of tracking)
const sleepId = 'cond-3';
// 4. Anxiety (Worsening Trend)
const anxietyId = 'cond-4';

export const MOCK_CONDITIONS = [
    { 
        id: migraineId, 
        label: 'Chronic Migraine', 
        bodyPart: 'Left Temple', 
        onsetDate: daysAgo(90).split('T')[0], 
        isArchived: false 
    },
    { 
        id: lumbarId, 
        label: 'Lumbar Strain', 
        bodyPart: 'Lower Back', 
        onsetDate: daysAgo(45).split('T')[0], 
        isArchived: false 
    },
    { 
        id: sleepId, 
        label: 'Insomnia', 
        bodyPart: 'General', 
        onsetDate: daysAgo(30).split('T')[0], 
        isArchived: false 
    },
    { 
        id: anxietyId, 
        label: 'Work Stress', 
        bodyPart: 'Head/Chest', 
        onsetDate: daysAgo(14).split('T')[0], 
        isArchived: false 
    },
];

const generateHistory = (conditionId, startDay, count, baseIntensity, variance, trend = 0) => {
    const logs = [];
    let currentIntensity = baseIntensity;
    
    for (let i = 0; i < count; i++) {
        // Apply trend
        currentIntensity += trend;
        
        // Apply random variance
        let val = Math.round(currentIntensity + (Math.random() * variance * 2 - variance));
        
        // Clamp 1-10
        val = Math.max(1, Math.min(10, val));
        
        // Randomly skip days to make it natural (70% chance to log)
        if (Math.random() > 0.3) {
             logs.push({
                id: `${conditionId}-${i}`,
                conditionId,
                date: daysAgo(startDay - i), // Reverse chronological generation
                intensity: val,
                medication: val > 6 ? (Math.random() > 0.5 ? 'Painkiller' : '') : '',
            });
        }
    }
    return logs;
};

export const MOCK_LOGS = [
    // Migraine: 60 days history, Base 6, Variance 3, No specific trend (Fluctuating)
    ...generateHistory(migraineId, 60, 40, 6, 3, 0),
    
    // Lumbar: 40 days history, Base 8, Variance 1, Trend -0.1 (Improving)
    ...generateHistory(lumbarId, 40, 30, 8, 1, -0.15),
    
    // Insomnia: 30 days history, Base 4, Variance 2, Trend 0 (Stable)
    ...generateHistory(sleepId, 30, 25, 4, 2, 0),
    
    // Anxiety: 14 days history, Base 3, Variance 1, Trend +0.4 (Worsening fast)
    ...generateHistory(anxietyId, 14, 12, 3, 1, 0.4),
];
