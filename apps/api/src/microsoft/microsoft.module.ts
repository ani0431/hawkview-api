import { Module } from '@nestjs/common';
import { TenantsModule } from '../tenants/tenants.module';
import { GraphService } from './graph.service';
import { MicrosoftController } from './microsoft.controller';
import { MicrosoftService } from './microsoft.service';

@Module({
  imports: [TenantsModule],
  controllers: [MicrosoftController],
  providers: [MicrosoftService, GraphService],
  exports: [MicrosoftService, GraphService],
})
export class MicrosoftModule {}
