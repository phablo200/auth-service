export function generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

export function otpExpiresAt(minutes = 5): Date {
    return new Date(Date.now() + minutes * 60 * 1000);
}