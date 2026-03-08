// Utility to handle Google Calendar OAuth and Event Creation
const CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com'; // Must be replaced by the user
const SCOPES = 'https://www.googleapis.com/auth/calendar.events';

export const initiateGoogleLogin = () => {
    return new Promise((resolve, reject) => {
        // Mocking the OAuth flow for rapid demonstration.
        // In reality, this would open a Google popup or redirect.
        
        // Simulating immediate success with a fake mock user
        const mockAuthRes = {
            email: 'vividori55790@gmail.com',
            token: 'mock_access_token_123',
            provider: 'Google'
        };
        
        // Simulating network delay
        setTimeout(() => {
            localStorage.setItem('bs-gcal-linked', JSON.stringify(mockAuthRes));
            resolve(mockAuthRes);
        }, 1000);
    });
};

export const getLinkedGoogleAccount = () => {
    const raw = localStorage.getItem('bs-gcal-linked');
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

export const unlinkGoogleAccount = () => {
    localStorage.removeItem('bs-gcal-linked');
};

export const syncEventToGoogleCalendar = async (logData, conditionLabel) => {
    const account = getLinkedGoogleAccount();
    if (!account) return { success: false, error: 'No account linked' };

    // Fake the Google Calendar API call for demonstration.
    // Real fetch request would look like:
    /*
    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${account.token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
             summary: `[Body Signal] ${conditionLabel} - Level ${logData.intensity}`,
             description: `Intensity: ${logData.intensity}\nMedication: ${logData.medication || 'None'}\nNotes: ${logData.notes || 'None'}`,
             start: { dateTime: logData.date },
             end: { dateTime: new Date(new Date(logData.date).getTime() + 30 * 60000).toISOString() }
        })
    });
    */
    
    return new Promise((resolve) => {
        setTimeout(() => {
            console.log(`Successfully synced to Google Calendar (${account.email})!`);
            resolve({ success: true, eventId: 'mock_event_id_' + Date.now() });
        }, 800); // 800ms to simulate network request latency
    });
};
