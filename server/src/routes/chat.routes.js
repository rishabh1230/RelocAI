import express from "express";
import { handleChat, getSessionHistory } from "../controllers/chat.controller.js";

const router = express.Router();

router.post("/", handleChat);
router.get("/:sessionId", getSessionHistory);

export default router;
