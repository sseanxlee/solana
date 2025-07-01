# Discord Account Linking Implementation

## Overview

We've successfully implemented a seamless Discord account linking system that allows users to connect their Discord accounts to their wallet addresses through a secure token-based flow.

## How It Works

### User Flow
1. **Invite Bot**: User visits frontend → Integrations → Invites Discord bot to their server
2. **Discord Link Command**: User runs `/link` command in Discord 
3. **Token Generation**: Bot generates secure 15-minute linking token
4. **Frontend Redirect**: User clicks link to frontend with token
5. **Wallet Connection**: If not authenticated, user connects wallet
6. **Account Linking**: System automatically links Discord to wallet account
7. **Confirmation**: User sees success message, alerts now sync across platforms

### Technical Flow
1. Discord bot generates linking token via `POST /api/auth/discord/generate-link-token`
2. Token stored in `discord_linking_tokens` table with 15-minute expiry
3. User redirected to `/link-discord?token=...` 
4. Frontend validates token via `GET /api/auth/discord/token-info/:token`
5. Once wallet connected, calls `POST /api/auth/discord/link-with-token`
6. System links Discord ID to wallet address in users table

## Implementation Details

### Database Changes
- **New Table**: `discord_linking_tokens`
  - `token`: 64-char unique secure token
  - `discord_user_id`: Discord user ID
  - `discord_username`: Discord username for display
  - `expires_at`: 15-minute expiry timestamp
  - `used`: Boolean flag to prevent reuse
  - `wallet_address`: Set when linking completes

### Backend API Endpoints
- `POST /api/auth/discord/generate-link-token` - Creates linking token (called by Discord bot)
- `GET /api/auth/discord/token-info/:token` - Validates token (called by frontend)
- `POST /api/auth/discord/link-with-token` - Links account (called by frontend)

### Discord Bot Updates
- Updated `/link` command to generate secure linking tokens
- Added `requireLinkedAccount()` check for `/setalert` and `/alerts` commands
- Improved error messages with helpful linking instructions
- Added fallback to manual linking if API unavailable

### Frontend Changes
- **New Page**: `/link-discord` - Handles token-based linking flow
- **Updated**: `/integrations` - Shows success messages after linking
- **New API Methods**: `getDiscordTokenInfo()`, `linkDiscordWithToken()`

## Security Features

### Token Security
- **Cryptographically secure**: 32-byte random tokens (64 hex chars)
- **Time-limited**: 15-minute expiry for security
- **Single-use**: Tokens marked as used after successful linking
- **Auto-cleanup**: Expired tokens can be cleaned up periodically

### Account Protection
- **Duplicate Prevention**: Users can't link already-linked Discord accounts
- **Placeholder Merging**: Seamlessly merges Discord-only accounts with wallet accounts
- **Wallet Verification**: Requires wallet signature to prove ownership

## Benefits Over Old System

### User Experience
- **One-Click**: No manual Discord ID copying/pasting
- **Guided Flow**: Clear instructions and visual feedback
- **Error Handling**: Helpful messages for expired/invalid tokens
- **Mobile Friendly**: Works on mobile Discord apps

### Technical Advantages  
- **Secure**: No manual ID entry that could be wrong/malicious
- **Automated**: No manual admin verification needed
- **Scalable**: Self-service linking for any number of users
- **Reliable**: Proper error handling and fallbacks

## Files Modified

### Backend
- `backend/schema.sql` - Added discord_linking_tokens table
- `backend/src/routes/auth.ts` - Added new linking endpoints
- `backend/src/services/discordBotService.ts` - Updated /link command + account checks

### Frontend  
- `frontend/src/app/link-discord/page.tsx` - New linking page (created)
- `frontend/src/app/integrations/page.tsx` - Added success messages
- `frontend/src/services/api.ts` - Added new API methods

### Configuration
- `env.example` - Added API_BASE_URL and FRONTEND_URL variables

## Usage Instructions

### For Users
1. Go to website → Integrations 
2. Click "Invite Discord Bot" 
3. Invite bot to your Discord server
4. Run `/link` command in Discord
5. Click the secure link provided
6. Connect wallet if needed
7. Account automatically linked!

### For Developers
1. Ensure environment variables are set (`API_BASE_URL`, `FRONTEND_URL`)
2. Run database migration to create new table
3. Restart backend and Discord bot services
4. New linking flow is now active

## Maintenance

### Token Cleanup
Consider adding a periodic cleanup job to remove expired tokens:
```sql
DELETE FROM discord_linking_tokens 
WHERE expires_at < NOW() - INTERVAL '1 day';
```

### Monitoring
- Monitor token generation/usage rates
- Track linking success/failure rates  
- Alert on unusually high token generation (potential abuse)

## Backwards Compatibility

The new system maintains full backwards compatibility:
- Existing manual Discord ID entry still works
- Already-linked accounts continue working normally
- Old linking flow serves as fallback if new system fails

This implementation provides a modern, secure, and user-friendly Discord account linking experience that significantly improves upon the previous manual system. 