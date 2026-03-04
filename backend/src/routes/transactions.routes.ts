import { Router } from 'express';
import multer from 'multer';
import { AppError } from '../errors/app-error.js';
import {
  createMyTransactionController,
  createTransactionController,
  deleteMyTransactionController,
  deleteTransactionController,
  getTransactionByIdController,
  importMyTransactionsController,
  listMyTransactionsController,
  listTransactionsController,
  updateMyTransactionController,
  updateTransactionController,
} from '../controllers/transactions.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const transactionsRouter = Router({ mergeParams: true });
const authTransactionsRouter = Router();

const CSV_UPLOAD_FIELD_NAME = 'file';
const MAX_CSV_SIZE_BYTES = 2 * 1024 * 1024;
const allowedCsvMimeTypes = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'text/plain',
]);

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_CSV_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    const hasCsvExtension = file.originalname.toLowerCase().endsWith('.csv');
    const hasAllowedMimeType = allowedCsvMimeTypes.has(file.mimetype);

    if (!hasCsvExtension && !hasAllowedMimeType) {
      callback(new AppError('Formato de ficheiro inválido. Envie um ficheiro .csv.', 400));
      return;
    }

    callback(null, true);
  },
});

transactionsRouter.get('/', listTransactionsController);
transactionsRouter.get('/:transactionId', getTransactionByIdController);
transactionsRouter.post('/', createTransactionController);
transactionsRouter.patch('/:transactionId', updateTransactionController);
transactionsRouter.delete('/:transactionId', deleteTransactionController);

authTransactionsRouter.use(requireAuth);

authTransactionsRouter.get('/', listMyTransactionsController);
authTransactionsRouter.post('/', createMyTransactionController);
authTransactionsRouter.post(
  '/import',
  csvUpload.single(CSV_UPLOAD_FIELD_NAME),
  importMyTransactionsController,
);
authTransactionsRouter.patch('/:id', updateMyTransactionController);
authTransactionsRouter.delete('/:id', deleteMyTransactionController);

export { authTransactionsRouter, transactionsRouter };
