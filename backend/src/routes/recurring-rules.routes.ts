import { Router } from 'express';
import {
  cancelMyRecurringRuleController,
  createMyRecurringRuleController,
  listMyRecurringExecutionsController,
  listMyRecurringRulesController,
  pauseMyRecurringRuleController,
  previewMyRecurringRuleController,
  resumeMyRecurringRuleController,
  updateMyRecurringRuleController,
} from '../controllers/recurring-rules.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const recurringRulesRouter = Router();

recurringRulesRouter.use(requireAuth);

recurringRulesRouter.get('/recurring-rules', listMyRecurringRulesController);
recurringRulesRouter.post('/recurring-rules', createMyRecurringRuleController);
recurringRulesRouter.patch('/recurring-rules/:ruleId', updateMyRecurringRuleController);
recurringRulesRouter.post('/recurring-rules/:ruleId/pause', pauseMyRecurringRuleController);
recurringRulesRouter.post('/recurring-rules/:ruleId/resume', resumeMyRecurringRuleController);
recurringRulesRouter.delete('/recurring-rules/:ruleId', cancelMyRecurringRuleController);
recurringRulesRouter.get('/recurring-rules/:ruleId/preview', previewMyRecurringRuleController);

recurringRulesRouter.get('/recurring-executions', listMyRecurringExecutionsController);

export { recurringRulesRouter };
