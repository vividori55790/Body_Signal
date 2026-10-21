export const initiateGoogleLogin = () => Promise.reject(new Error(
    'Google Calendar integration is not configured. Use calendar export instead.',
));

export const getLinkedGoogleAccount = () => {
    const raw = localStorage.getItem('bs-gcal-linked');
    if (!raw) return null;

    try {
        return JSON.parse(raw);
    } catch {
        console.error('Stored Google Calendar account data is invalid.');
        localStorage.removeItem('bs-gcal-linked');
        return null;
    }
};

export const unlinkGoogleAccount = () => {
    localStorage.removeItem('bs-gcal-linked');
};

export const syncEventToGoogleCalendar = async () => ({
    success: false,
    error: 'Google Calendar integration is not configured.',
});
