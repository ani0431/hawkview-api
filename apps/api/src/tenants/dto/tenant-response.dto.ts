import { ApiProperty } from '@nestjs/swagger';

export class TenantResponseDto {
  @ApiProperty({ description: 'HawkView tenant record id.' })
  id!: string;

  @ApiProperty({
    description:
      'Human-readable name for the connected Microsoft tenant. Defaults to the Microsoft tenant id until enriched in a later phase.',
  })
  displayName!: string;

  @ApiProperty({
    description: 'Microsoft 365 tenant id (GUID) returned during admin consent.',
  })
  microsoftTenantId!: string;

  @ApiProperty({
    description: 'Timestamp when the tenant was first connected.',
    type: String,
    format: 'date-time',
  })
  connectedAt!: Date;

  @ApiProperty({
    description:
      'Whether the connection is currently active. False after the tenant has been disconnected.',
  })
  isActive!: boolean;
}
