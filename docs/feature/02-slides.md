
컴포넌트 / 페이지 목업 와이어프레임 

현재 이 프로젝트에서 주로 사용되는 구역은 프로젝트별 테이블뷰이다.

하지만 **슬라이드 기획서** 보기라는 영역을 추가하려고 한다.

각각의 페이지들에 해당하는 목업 와이어프레임을 기획서 양식과 같이 볼 수 있다.

페이지들은 별도 **구역**이라는 영역으로 묶일 수 있다.

페이지는 **버전**을 가질 수 있다.



# 정리
필요한 페이지 : 슬라이드 기획서

각 기획서 한 페이지당 슬라이드 기획서를 적을 수 있다. 
내용을 채우는 것은 나중에 Claude 세션과 대화를 주고 받으면서 내용을 채우기로 한다.
본문은 md 파일로 와이어프레임을 만들어낼 것이며 https://wiremd.dev 처럼 md 파일을 만들어서 렌더링해서 슬라이드에서 기획서 양식으로 보여지게 할 것이다.

와이어프레임에서 (1), (2) 번같은 항목을 지정할 수 있으며, 우측 사이드 영역에는 (1), (2)번 에 대한 설명을 적을 수 있다.

# 필요한 테이블

테이블명 : slide
개요 : 하나의 와이어프레임을 담을 수 있는 슬라이드
id: primary key, auto increment
project_id: number, 프로젝트 테이블의 id 참조
version: number, 버전
content: text, md 형식의 슬라이드 기획서 내용


테이블명 : slide_section
개요 : 슬라이드를 묶을 섹션 정의
id: primary key, auto increment
name: 섹션 이름

테이블명 : slide_section_slide
개요 : 슬라이드와 섹션의 연결 테이블
id: primary key, auto increment
section_id: number, slide_section 테이블의 id 참조
slide_id: number, slide 테이블의 id 참조

테이블명 : slide_comment
개요 : 슬라이드에 대한 코멘트
id: primary key, auto increment
slide_id: number, slide 테이블의 id 참조
comment_num : number, 슬라이드 내에서 코멘트 번호 (1, 2, 3...)
commment: text, 코멘트 내용
