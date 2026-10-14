import { getJson, postJson } from './client'

export const fetchCurrentUser = () => getJson('/customer-auth/me').then(({ user }) => user)
// Which one-time-code options the API offers: { signupOtp, loginOtpPhone, loginOtpEmail }.
export const fetchOtpConfig = () => getJson('/customer-auth/otp-config')

export const login = (identifier, password) => postJson('/customer-auth/login', { identifier, password })
export const register = (details) => postJson('/customer-auth/register', details)
export const sendLoginCode = (identifier) => postJson('/customer-auth/login-otp', { identifier })
export const verifyLoginCode = (identifier, code) => postJson('/customer-auth/login-otp/verify', { identifier, code })
// Sign-up verifies the mobile number by SMS when SMS is configured.
export const sendSignupCode = (phone) => postJson('/customer-auth/signup-otp', { phone })
export const logout = () => postJson('/customer-auth/logout')
