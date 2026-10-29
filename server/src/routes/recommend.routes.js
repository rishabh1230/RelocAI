import express from "express";
import { recommendPlaces, recommendLocalities } from
  "../controllers/recommend.controller.js";

const router = express.Router();

router.post("/", recommendPlaces);
router.post("/localities", recommendLocalities);

export default router;
