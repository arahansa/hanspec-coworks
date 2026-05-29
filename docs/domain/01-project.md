# 개요
프로젝트(project) 정보를 저장할 수 있는 도메인

# 프로젝트(project) 테이블 필드들
id: 멤버의 고유 식별자(숫자) auto increment
name : 프로젝트 이름
slug : 프로젝트 고유 슬러그
description : 프로젝트 설명

# 도메인에 대하여 화면 필요한 것
CRUD - 슈퍼관리자 화면에서 접근 가능

# 관련 페이지
../pages/01-project.md

# 연관 테이블(entity)
- project_member : 프로젝트에 참여한 멤버들의 정보를 저장하는 테이블
