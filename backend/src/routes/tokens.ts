import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { TokenService } from '../services/tokenService';

const router = Router();
const tokenService = new TokenService();

// All token routes require authentication
router.use(authenticateToken);

// Validate token address - fix the route path
router.get('/validate', async (req, res) => {
    try {
        const { address } = req.query;

        if (!address || typeof address !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Token address is required'
            });
        }

        console.log(`Validating token address: ${address}`);
        const isValid = await tokenService.validateTokenAddress(address);

        res.json({
            success: true,
            data: { isValid }
        });
    } catch (error) {
        console.error('Error validating token:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to validate token address'
        });
    }
});

// Search tokens by name/symbol
router.get('/search', async (req, res) => {
    try {
        const { query } = req.query;

        if (!query || typeof query !== 'string' || query.length < 2) {
            return res.status(400).json({
                success: false,
                error: 'Search query must be at least 2 characters'
            });
        }

        console.log(`Searching tokens with query: ${query}`);
        const tokens = await tokenService.searchTokens(query);

        res.json({
            success: true,
            data: tokens
        });
    } catch (error) {
        console.error('Error searching tokens:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to search tokens'
        });
    }
});

// Trending tokens endpoint removed - not needed

// Search tokens by contract address
router.get('/search', async (req, res) => {
    try {
        const { address } = req.query;

        if (!address || typeof address !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Contract address is required'
            });
        }

        console.log(`Searching for token with address: ${address}`);

        const tokenService = new TokenService();
        const tokens = await tokenService.searchTokens(address);

        res.json({
            success: true,
            data: tokens
        });
    } catch (error) {
        console.error('Error searching tokens:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to search tokens',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Get token data by address
router.get('/:address', async (req, res) => {
    try {
        const { address } = req.params;

        if (!address) {
            return res.status(400).json({
                success: false,
                error: 'Token address is required'
            });
        }

        console.log(`Fetching token data for: ${address}`);
        const tokenData = await tokenService.getTokenData(address);

        if (!tokenData) {
            return res.status(404).json({
                success: false,
                error: 'Token not found or invalid address'
            });
        }

        res.json({
            success: true,
            data: tokenData
        });
    } catch (error) {
        console.error('Error fetching token data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch token data'
        });
    }
});

// Get token pairs by address
router.get('/:address/pairs', async (req, res) => {
    try {
        const { address } = req.params;

        if (!address) {
            return res.status(400).json({
                success: false,
                error: 'Token address is required'
            });
        }

        console.log(`Fetching token pairs for: ${address}`);
        const pairsData = await tokenService.getTokenPairs(address);

        if (!pairsData) {
            return res.status(404).json({
                success: false,
                error: 'No pairs found for this token'
            });
        }

        res.json({
            success: true,
            data: pairsData
        });
    } catch (error) {
        console.error('Error fetching token pairs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch token pairs'
        });
    }
});

// Get token metadata by address
router.get('/:address/metadata', async (req, res) => {
    try {
        const { address } = req.params;

        if (!address) {
            return res.status(400).json({
                success: false,
                error: 'Token address is required'
            });
        }

        console.log(`Fetching token metadata for: ${address}`);
        const metadataData = await tokenService.getTokenMetadata(address);

        if (!metadataData) {
            return res.status(404).json({
                success: false,
                error: 'No metadata found for this token'
            });
        }

        res.json({
            success: true,
            data: metadataData
        });
    } catch (error) {
        console.error('Error fetching token metadata:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch token metadata'
        });
    }
});

export default router; 