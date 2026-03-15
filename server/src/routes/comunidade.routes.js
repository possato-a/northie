import { Router } from 'express';
import {
    getPosts, createPost, toggleLike, getComments, addComment,
    getMembers, getMyStats,
    getEvents, enrollEvent,
    getDrops,
} from '../controllers/comunidade.controller.js';

const router = Router();

// Posts
router.get('/', getPosts);
router.post('/', createPost);
router.post('/:id/like', toggleLike);
router.get('/:id/comments', getComments);
router.post('/:id/comments', addComment);

// Membros
router.get('/members', getMembers);
router.get('/me', getMyStats);

// Eventos
router.get('/events', getEvents);
router.post('/events/:id/enroll', enrollEvent);

// Drops
router.get('/drops', getDrops);

export default router;
