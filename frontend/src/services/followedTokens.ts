interface FollowedToken {
    address: string;
    name: string;
    symbol: string;
    logo?: string;
    followedAt: number;
}

class FollowedTokensService {
    private readonly STORAGE_KEY = 'stride_followed_tokens';

    getFollowedTokens(): FollowedToken[] {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error loading followed tokens:', error);
            return [];
        }
    }

    followToken(token: { address: string; name: string; symbol: string; logo?: string }): void {
        try {
            const followedTokens = this.getFollowedTokens();

            // Check if token is already followed
            if (followedTokens.some(t => t.address === token.address)) {
                return; // Already followed
            }

            const newToken: FollowedToken = {
                ...token,
                followedAt: Date.now()
            };

            const updatedTokens = [newToken, ...followedTokens];
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedTokens));

            // Dispatch custom event for same-tab updates
            window.dispatchEvent(new CustomEvent('followedTokensChanged'));
        } catch (error) {
            console.error('Error following token:', error);
        }
    }

    unfollowToken(address: string): void {
        try {
            const followedTokens = this.getFollowedTokens();
            const updatedTokens = followedTokens.filter(t => t.address !== address);
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedTokens));

            // Dispatch custom event for same-tab updates
            window.dispatchEvent(new CustomEvent('followedTokensChanged'));
        } catch (error) {
            console.error('Error unfollowing token:', error);
        }
    }

    isTokenFollowed(address: string): boolean {
        try {
            const followedTokens = this.getFollowedTokens();
            return followedTokens.some(t => t.address === address);
        } catch (error) {
            console.error('Error checking if token is followed:', error);
            return false;
        }
    }

    clearAllFollowedTokens(): void {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
        } catch (error) {
            console.error('Error clearing followed tokens:', error);
        }
    }
}

export const followedTokensService = new FollowedTokensService();
export type { FollowedToken }; 