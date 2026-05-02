import { Module } from '@nestjs/common';
import { GraphService } from './graph.service';
import { MicrosoftController } from './microsoft.controller';
import { MicrosoftService } from './microsoft.service';

@Module({
  controllers: [MicrosoftController],
  providers: [MicrosoftService, GraphService],
  exports: [MicrosoftService, GraphService],
})
export class MicrosoftModule {}
