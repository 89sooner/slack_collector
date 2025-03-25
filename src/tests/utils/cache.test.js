/**
 * 캐시 유틸리티 테스트
 */
const { expect } = require("chai");
const { MemoryCache } = require("../../utils/cache");

describe("Cache 유틸리티", () => {
  let cache;

  beforeEach(() => {
    // 각 테스트 전에 새로운 캐시 인스턴스 생성
    cache = new MemoryCache({
      ttl: 100, // 빠른 테스트를 위한 짧은 TTL
      cleanupInterval: false, // 테스트 중 자동 정리 비활성화
    });
  });

  afterEach(() => {
    // 테스트 후 리소스 정리
    cache.destroy();
  });

  it("항목을 설정하고 조회할 수 있어야 함", () => {
    cache.set("testKey", "testValue");
    expect(cache.get("testKey")).to.equal("testValue");
  });

  it("존재하지 않는 키에 대해 null 반환", () => {
    expect(cache.get("nonexistentKey")).to.be.null;
  });

  it("TTL 기간 후 항목이 만료되어야 함", (done) => {
    cache.set("expiringKey", "expiringValue", 50);

    // TTL 내에는 값이 존재해야 함
    expect(cache.get("expiringKey")).to.equal("expiringValue");

    // TTL 이후에는 null을 반환해야 함
    setTimeout(() => {
      expect(cache.get("expiringKey")).to.be.null;
      done();
    }, 60);
  });

  it("항목을 명시적으로 삭제할 수 있어야 함", () => {
    cache.set("keyToDelete", "value");
    expect(cache.get("keyToDelete")).to.equal("value");

    cache.delete("keyToDelete");
    expect(cache.get("keyToDelete")).to.be.null;
  });

  it("캐시를 완전히 비울 수 있어야 함", () => {
    cache.set("key1", "value1");
    cache.set("key2", "value2");

    cache.clear();

    expect(cache.get("key1")).to.be.null;
    expect(cache.get("key2")).to.be.null;
    expect(cache.getStats().size).to.equal(0);
  });

  it("최대 크기를 초과하면 가장 오래된 항목을 제거해야 함", () => {
    const smallCache = new MemoryCache({ maxSize: 2 });

    smallCache.set("key1", "value1");
    smallCache.set("key2", "value2");
    smallCache.set("key3", "value3");

    // 가장 오래된 key1이 제거되어야 함
    expect(smallCache.get("key1")).to.be.null;
    expect(smallCache.get("key2")).to.equal("value2");
    expect(smallCache.get("key3")).to.equal("value3");

    smallCache.destroy();
  });

  it("통계 정보를 정확히 보고해야 함", () => {
    cache.get("miss1"); // miss
    cache.get("miss2"); // miss

    cache.set("hit1", "value1");
    cache.get("hit1"); // hit
    cache.get("hit1"); // hit

    const stats = cache.getStats();
    expect(stats.hits).to.equal(2);
    expect(stats.misses).to.equal(2);
    expect(stats.size).to.equal(1);
    expect(parseFloat(stats.hitRatio)).to.equal(0.5);
  });
});
