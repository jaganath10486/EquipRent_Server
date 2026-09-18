import { IRequest } from "@interfaces/request.interface";
import { Response, NextFunction } from "express";
import { equipmentService } from "@src/services/equipment.service";
import { GeminiService } from "@src/services/gemini.service";
import { kitService } from "@src/services/kit.service";
import HttpExceptionError from "@src/exception/httpexception";

export class AIController {
  private geminiService = GeminiService.getInstance();
  private equipmentService = equipmentService;

  public compareEquipments = async (
    req: IRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { equipmentId1, equipmentId2 } = req.body;

      if (equipmentId1 === equipmentId2)
        throw new HttpExceptionError(400, "Cannot compare an item with itself");

      const userId = req.user?.userId || "";
      const [equipment1, equipment2] = await Promise.all([
        this.equipmentService.getEquipmentById(equipmentId1, userId),
        this.equipmentService.getEquipmentById(equipmentId2, userId),
      ]);
      if (!equipment1)
        throw new HttpExceptionError(404, "First equipment not found");
      if (!equipment2)
        throw new HttpExceptionError(404, "Second equipment not found");

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      const stream = await this.geminiService.generateEquipmentComparisonStream(
        equipment1,
        equipment2
      );
      for await (const chunk of stream) {
        if (chunk.text) {
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
      }
      res.write(`data: [DONE]\n\n`);
      res.end();
    } catch (err: any) {
      if (!res.headersSent) {
        next(err);
      } else {
        res.write(
          `data: ${JSON.stringify({ error: "Failed to generate comparison" })}\n\n`
        );
        res.end();
      }
    }
  };

  public naturalSearchEquipments = async (
    req: IRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { query } = req.body;

      // The parser is given the real category tree. Without it the model
      // invented names ("Event Equipment", "Fitness Equipment") that matched
      // nothing, the category filter was silently dropped, and unranked keyword
      // matches surfaced a DSLR for a tent query.
      const taxonomy = await this.equipmentService.getTaxonomy();
      const parsedFilters = await this.geminiService.parseNaturalSearchQuery(
        query,
        taxonomy
      );
      const { results, usedFallback, matchedCategoryId, hasExactMatch } =
        await this.equipmentService.naturalSearchEquipments(parsedFilters, query);

      // Demand signal, including the searches that found nothing.
      void this.equipmentService.recordSearch({
        query,
        userId: req.user?.userId,
        filters: parsedFilters,
        matchedCategoryId,
        resultCount: results.length,
        usedFallback,
      });

      res
        .status(200)
        .json({ data: { results, parsedFilters, usedFallback, hasExactMatch } });
    } catch (err) {
      next(err);
    }
  };

  public buildKit = async (req: IRequest, res: Response, next: NextFunction) => {
    try {
      const data = await kitService.buildKit(req.body);
      res.status(200).json({ data, message: "Assembled kit" });
    } catch (err) {
      next(err);
    }
  };

  public summarizeEquipment = async (
    req: IRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const id = req.params.id?.toString();
      if (!id) throw new HttpExceptionError(400, "Equipment ID is required");

      const userId = req.user?.userId || "";
      const equipment = await this.equipmentService.getEquipmentById(
        id,
        userId
      );
      if (!equipment) throw new HttpExceptionError(404, "Equipment not found");

      const summary =
        await this.geminiService.generateStructuredEquipmentSummary(equipment);
      res.status(200).json({ data: summary });
    } catch (err) {
      next(err);
    }
  };
}
