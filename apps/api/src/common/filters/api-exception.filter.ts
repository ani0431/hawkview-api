import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const excResponse = exception.getResponse();
      let code = 'HTTP_EXCEPTION';
      let message = 'An error occurred';

      if (typeof excResponse === 'string') {
        message = excResponse;
      } else if (typeof excResponse === 'object' && excResponse !== null) {
        const body = excResponse as Record<string, unknown>;
        if (typeof body.code === 'string') {
          code = body.code;
        }
        if (typeof body.message === 'string') {
          message = body.message;
        } else if (Array.isArray(body.message)) {
          message = (body.message as string[]).join(', ');
        }
      }

      if (code === 'HTTP_EXCEPTION') {
        if (status === HttpStatus.UNAUTHORIZED) code = 'UNAUTHORIZED';
        else if (status === HttpStatus.FORBIDDEN) code = 'FORBIDDEN';
        else if (status === HttpStatus.NOT_FOUND) code = 'NOT_FOUND';
        else if (status === HttpStatus.CONFLICT) code = 'CONFLICT';
        else if (status === HttpStatus.BAD_REQUEST) code = 'VALIDATION_ERROR';
      }

      response.status(status).json({
        success: false,
        error: { code, message },
      });
      return;
    }

    const message =
      exception instanceof Error ? exception.message : 'Internal server error';
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message },
    });
  }
}
