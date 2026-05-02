import { Injectable } from '@nestjs/common';
import { GraphService } from './graph.service';

@Injectable()
export class MicrosoftService {
  constructor(private readonly graph: GraphService) {}
}
