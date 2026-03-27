export abstract class BaseRepository<T, CreateDto, UpdateDto> {
  protected abstract readonly modelName: string;

  async findById(id: string, organizationId: string, tx?: any): Promise<T | null> {
    const client = tx || global.prisma;
    return client[this.modelName].findFirst({
      where: { id, organizationId }
    });
  }

  async create(data: CreateDto & { organizationId: string }, tx?: any): Promise<T> {
    const client = tx || global.prisma;
    return client[this.modelName].create({
      data
    });
  }

  async update(id: string, data: UpdateDto, organizationId: string, tx?: any): Promise<T> {
    const client = tx || global.prisma;
    return client[this.modelName].update({
      where: { id_organizationId: { id, organizationId } },
      data
    });
  }

  async delete(id: string, organizationId: string, tx?: any): Promise<T> {
    const client = tx || global.prisma;
    return client[this.modelName].delete({
      where: { id_organizationId: { id, organizationId } }
    });
  }
}
