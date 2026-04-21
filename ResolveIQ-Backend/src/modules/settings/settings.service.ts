import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting } from './entities/setting.entity';
import * as crypto from 'crypto';

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name);
  private cache = new Map<string, any>();
  private encryptedKeys = new Set<string>();
  private readonly encryptionKey: Buffer;
  
  constructor(
    @InjectRepository(SystemSetting)
    private repo: Repository<SystemSetting>,
  ) {
    const envKey = process.env.SETTINGS_ENCRYPTION_KEY || 'default-secret-key-must-be-32-chars-long!'; 
    this.encryptionKey = Buffer.from(envKey.padEnd(32, '0').slice(0, 32), 'utf8');
  }

  async onModuleInit() {
    await this.loadAllIntoCache();
  }

  async loadAllIntoCache() {
    this.encryptedKeys.clear();
    const settings = await this.repo.find();
    for (const s of settings) {
      try {
        if (s.isEncrypted) this.encryptedKeys.add(s.key);
        const val = s.isEncrypted ? this.decrypt(s.value) : this.parseIfJson(s.value);
        this.cache.set(s.key, val);
      } catch (err) {
        this.logger.error(`Failed to load setting ${s.key}`, err);
      }
    }
    this.logger.log(`Loaded ${settings.length} system settings into cache.`);
  }

  get<T>(key: string, defaultValue?: T): T {
    if (this.cache.has(key)) return this.cache.get(key) as T;
    return defaultValue as T;
  }

  async set(key: string, value: any, encrypt = false) {
    if (encrypt) {
      this.encryptedKeys.add(key);
    } else {
      this.encryptedKeys.delete(key);
    }
    this.cache.set(key, value);
    
    let dbValue = '';
    if (value !== undefined && value !== null) {
      dbValue = typeof value === 'string' ? value : JSON.stringify(value);
    }
    
    if (encrypt) {
      dbValue = this.encrypt(dbValue);
    }
    
    await this.repo.save({ key, value: dbValue, isEncrypted: encrypt });
    this.logger.log(`Setting updated: ${key} (Encrypted: ${encrypt})`);
  }

  async getMultiple(keys: string[]) {
    const result: Record<string, any> = {};
    for (const k of keys) {
      result[k] = this.get(k);
    }
    return result;
  }

  isKeyEncrypted(key: string): boolean {
    return this.encryptedKeys.has(key);
  }

  private parseIfJson(val: string): any {
    try { return JSON.parse(val); } catch { return val; }
  }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  private decrypt(text: string): string {
    const parts = text.split(':');
    if (parts.length !== 3) return this.parseIfJson(text); 
    
    const [ivHex, authTagHex, encryptedHex] = parts;
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, Buffer.from(ivHex, 'hex'));
      decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return this.parseIfJson(decrypted);
    } catch (err) {
      this.logger.error('Decryption failed for a setting', err);
      return text;
    }
  }
}
