import app from '../server/dist/index.js';

// Vercel Entry Point
export default async (req: any, res: any) => {
    try {
        // Express handles the request
        return app(req, res);
    } catch (error: any) {
        console.error('[Vercel API] Runtime Error:', error);
        res.status(500).json({
            error: 'Internal Server Error (Vercel)',
            message: error.message,
            stack: error.stack
        });
    }
};
