import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Timestamp,
  UpdateDateColumn,
} from 'typeorm'

@Entity('humidity')
@Index(['deviceId', 'createdAt'])
export class DBHumidity extends BaseEntity {
  @PrimaryGeneratedColumn('increment', {
    type: 'int',
    comment: 'Id',
  })
  rowId!: number

  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
    comment: 'デバイス ID',
  })
  deviceId!: string | null

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: 'デバイス名',
  })
  deviceName!: string | null

  @Column({
    type: 'double',
    comment: '値',
  })
  value!: number

  @CreateDateColumn({
    comment: 'データ登録日時',
  })
  createdAt!: Timestamp

  @UpdateDateColumn({
    comment: 'データ更新日時',
  })
  updatedAt!: Timestamp
}
