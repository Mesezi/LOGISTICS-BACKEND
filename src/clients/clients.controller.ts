import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ClientsService } from './clients.service.js';
import { CurrentUser } from '../common/decorators/current-user-decorator.js';
import { ListClientsDto } from './dto/list-clients.dto.js';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import { CreateClientDto } from './dto/create-client.dto.js';

@Controller('clients')
export class ClientsController {
    constructor(private readonly clients: ClientsService){}

 @Get()
list(
  @CurrentUser() user: AuthenticatedUser,
  @Query() query: ListClientsDto,
) {
  return this.clients.list(user, query);
}

@Get(':id')
findOne(
  @Param('id', ParseIntPipe) id: number,
  @CurrentUser() user: AuthenticatedUser,
) {
  return this.clients.findOne(id, user);
}

@Post()
create(
  @CurrentUser() user: AuthenticatedUser,
  @Body() body: CreateClientDto,
) {
  return this.clients.create(user, body);
}

@Patch(':id')
update(
  @Param('id', ParseIntPipe) id: number,
  @CurrentUser() user: AuthenticatedUser,
  @Body() body: Partial<CreateClientDto>,
) {
  return this.clients.update(id, user, body);
}

@Delete(':id')
delete(
  @Param('id', ParseIntPipe) id: number,
  @CurrentUser() user: AuthenticatedUser,
) {
  return this.clients.delete(id, user);
}

}
